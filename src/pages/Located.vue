<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as turf from '@turf/turf'                 // <— 新增：Turf
import FilterModal from '@/components/FilterModal.vue'

/* ===== 篩選狀態 ===== */
const selectedCats = ref<string[]>([])
const selectedDists = ref<string[]>([])
const modalOpen = ref(false)
function openFilter() { modalOpen.value = true }
function closeFilter() { modalOpen.value = false }
function confirmFilter(payload: { cats: string[]; dists: string[] }) {
  selectedCats.value = payload.cats
  selectedDists.value = payload.dists
  modalOpen.value = false
}

/* ===== Mapbox ===== */
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string
mapboxgl.accessToken = MAPBOX_TOKEN
let map: mapboxgl.Map | null = null
const mapEl = ref<HTMLDivElement | null>(null)

const SOURCE_ID = 'sports-src'
const LAYER_ID = 'sports-pts'
const HALO_SOURCE_ID = 'sports-halo'
const HALO_FILL_ID = 'sports-halo-fill'
const HALO_LINE_ID = 'sports-halo-line'
const RIPPLE_SOURCE_ID = 'ripple-src'
const RIPPLE_LAYER_ID = 'ripple-layer'

const ROUTE_SOURCE_ID = 'route-src'
const ROUTE_LAYER_ID = 'route-line'

/** ====== Icon 對應（依類別關鍵字）====== */
const FALLBACK_ICON = 'running' // public/icons/running.png

// Mapbox 表達式：依 properties.category 取對應 icon 名稱字串
// 將類別字串轉小寫再做子字串比對（同時支援中英文關鍵字）
const iconExpression: any = [
  'let',
  'cat',
  ['downcase', ['to-string', ['get', 'category']]],

  // case 依序比對
  ['case',

    // 籃球
    ['any',
      ['>=', ['index-of', '籃球', ['var', 'cat']], 0],
      ['>=', ['index-of', 'basketbal', ['var', 'cat']], 0]
    ], 'basketbal' ,

    // 羽球 / badminton
    ['any',
      ['>=', ['index-of', '羽球', ['var', 'cat']], 0],
      ['>=', ['index-of', 'badminton', ['var', 'cat']], 0]
    ], 'badminton',

    // 網球 / 練習壁 / tenniss
    ['any',
      ['>=', ['index-of', '網球', ['var', 'cat']], 0],
      ['>=', ['index-of', '練習壁', ['var', 'cat']], 0],
      ['>=', ['index-of', 'tenniss', ['var', 'cat']], 0]
    ], 'tenniss',

    // 棒球 / 壘球 / 棒壘球 / basebal / softball
    ['any',
      ['>=', ['index-of', '棒球', ['var', 'cat']], 0],
      ['>=', ['index-of', '壘球', ['var', 'cat']], 0],
      ['>=', ['index-of', '棒壘球', ['var', 'cat']], 0],
      ['>=', ['index-of', 'basebal', ['var', 'cat']], 0],
      ['>=', ['index-of', 'softball', ['var', 'cat']], 0]
    ], 'basebal',

    // 足球
    ['any',
      ['>=', ['index-of', '足球', ['var', 'cat']], 0],
      ['>=', ['index-of', 'soccer', ['var', 'cat']], 0]
    ], 'soccer-player',

    // 溜冰 / 滑板 / 競速
    ['any',
      ['>=', ['index-of', '溜冰', ['var', 'cat']], 0],
      ['>=', ['index-of', '滑板', ['var', 'cat']], 0],
      ['>=', ['index-of', '競速', ['var', 'cat']], 0]
    ], 'roller-skater',

    // 槌球
    ['any',
      ['>=', ['index-of', '槌球', ['var', 'cat']], 0]], 'croquet',

    // 排球
    ['any',
      ['>=', ['index-of', '排球', ['var', 'cat']], 0]], 'block',

    // default
    FALLBACK_ICON
  ]
]

// 只載入一次 icons
async function ensureIconsLoaded() {
  if (!map) return
  const loadAndAdd = (name: string, url: string) =>
    new Promise<void>((resolve, reject) => {
      if (map!.hasImage(name)) return resolve()
      map!.loadImage(url, (err, image) => {
        if (err || !image) return reject(err)
        map!.addImage(name, image, { pixelRatio: 2 })
        resolve()
      })
    })
  await Promise.all([
    loadAndAdd('basketbal',     '/icons/basketbal.png'),
    loadAndAdd('tenniss',         '/icons/tenniss.png'),
    loadAndAdd('soccer-player',  '/icons/soccer-player.png'),
    loadAndAdd('roller-skater',  '/icons/roller-skater.png'),
    loadAndAdd('croquet',        '/icons/croquet.png'),
    loadAndAdd('block',          '/icons/block.png'),
    loadAndAdd('basebal',       '/icons/basebal.png'),
    loadAndAdd('badminton',      '/icons/badminton.png'),
    loadAndAdd(FALLBACK_ICON,    `/icons/${FALLBACK_ICON}.png`),
  ])
}

let userMarker: mapboxgl.Marker | null = null
let destMarker: mapboxgl.Marker | null = null
const currentDest = ref<[number, number] | null>(null)

/* ===== 後端資料（外層 data: [...]） ===== */
const API_BASE = ''
const DATA_URL = `${API_BASE}/api/dataset`

type Row = {
  id: number
  行政區: string
  場地: string
  類別: string
  緯度: number
  經度: number
}
type ApiRes = { data: Row[] }

const geojson = ref<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] })

function toGeoJSON(arr: Row[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: arr
      .filter((x) => Number.isFinite(x.經度) && Number.isFinite(x.緯度))
      .map((item) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.經度, item.緯度] },
        properties: {
          id: item.id,
          district: item.行政區,
          venue: item.場地,
          category: item.類別,
        },
      })),
  }
}

async function loadDataset() {
  const r = await fetch(DATA_URL)
  if (!r.ok) throw new Error('載入資料失敗')
  const j = (await r.json()) as ApiRes
  geojson.value = toGeoJSON(j.data)
  if (map && map.getSource(SOURCE_ID)) {
    (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson.value)
    // 同步 halo
    updateHalo()
    fitToData()
    applyFilter()
  }
}

/* ===== 篩選清單 ===== */
const categories = computed(() => {
  const s = new Set<string>()
  for (const f of geojson.value.features) s.add((f.properties as any)?.category)
  return Array.from(s)
})
const districts = computed(() => {
  const s = new Set<string>()
  for (const f of geojson.value.features) s.add((f.properties as any)?.district)
  return Array.from(s)
})

/* ===== Halo（固定公尺半徑） ===== */
function radiusMetersByCategory(cat = '') {
  const c = String(cat).toLowerCase()
  if (c.includes('籃球')) return 60
  if (c.includes('羽球') || c.includes('badminton')) return 40
  if (c.includes('網球') || c.includes('tenniss')) return 50
  if (c.includes('棒球') || c.includes('壘球')) return 90
  if (c.includes('足球') || c.includes('soccer')) return 120
  if (c.includes('溜冰') || c.includes('滑板') || c.includes('競速')) return 50
  if (c.includes('槌球')) return 45
  if (c.includes('排球')) return 50
  return 60
}

function buildHaloPolygons(pointFC: GeoJSON.FeatureCollection) {
  const polys: GeoJSON.Feature[] = []
  for (const f of pointFC.features) {
    if (!f.geometry || f.geometry.type !== 'Point') continue
    const [lng, lat] = (f.geometry as any).coordinates as [number, number]
    const r = radiusMetersByCategory((f.properties as any)?.category)
    const circle = turf.circle([lng, lat], r, { steps: 64, units: 'meters' })
    ;(circle as any).properties = { ...(f.properties as any) }
    polys.push(circle as GeoJSON.Feature)
  }
  return turf.featureCollection(polys) as GeoJSON.FeatureCollection
}

function updateHalo() {
  if (!map) return
  const haloFC = buildHaloPolygons(geojson.value)
  if (map.getSource(HALO_SOURCE_ID)) {
    (map.getSource(HALO_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(haloFC)
  } else {
    map.addSource(HALO_SOURCE_ID, { type: 'geojson', data: haloFC })
    const colorExpr: any = [
      'case',
      ['in', '籃球', ['get', 'category']], '#e76f51',
      ['any', ['in', '羽球', ['get', 'category']], ['in', 'badminton', ['downcase', ['get','category']]]], '#2a9d8f',
      ['any', ['in', '網球', ['get', 'category']], ['in', 'tenniss', ['downcase', ['get','category']]], ['in', '練習壁', ['get','category']]], '#f4a261',
      ['any', ['in', '棒球', ['get', 'category']], ['in', '壘球', ['get', 'category']]], '#457b9d',
      ['any', ['in', '足球', ['get', 'category']], ['in', 'soccer', ['downcase', ['get','category']]]], '#718355',
      ['any', ['in', '溜冰', ['get','category']], ['in', '滑板', ['get','category']], ['in', '競速', ['get','category']]], '#8d99ae',
      ['in', '槌球', ['get', 'category']], '#8a5a44',
      ['in', '排球', ['get', 'category']], '#c77dff',
      '#6c5ce7'
    ]
    // ⬇ 關鍵：把 HALO 插到點位層之前（避免遮住 icon）
    map.addLayer(
      { id: HALO_FILL_ID, type: 'fill', source: HALO_SOURCE_ID, paint: { 'fill-color': colorExpr, 'fill-opacity': 0.18 } },
      LAYER_ID
    )
    map.addLayer(
      { id: HALO_LINE_ID, type: 'line', source: HALO_SOURCE_ID, paint: { 'line-color': colorExpr, 'line-opacity': 0.35, 'line-width': 1 } },
      LAYER_ID
    )
  }
}

/* ===== Popup 組裝 ===== */
function pickIconName(category = '') {
  const c = String(category).toLowerCase()
  if (c.includes('籃球')) return 'basketbal'
  if (c.includes('羽球') || c.includes('badminton')) return 'badminton'
  if (c.includes('網球') || c.includes('tenniss') || c.includes('練習壁')) return 'tenniss'
  if (c.includes('棒球') || c.includes('壘球') || c.includes('棒壘球') || c.includes('basebal') || c.includes('softball')) return 'basebal'
  if (c.includes('足球') || c.includes('soccer')) return 'soccer-player'
  if (c.includes('溜冰') || c.includes('滑板') || c.includes('競速')) return 'roller-skater'
  if (c.includes('槌球')) return 'croquet'
  if (c.includes('排球')) return 'block'
  return FALLBACK_ICON
}

function buildPopupDOM(f: mapboxgl.MapboxGeoJSONFeature) {
  const props = f.properties as any
  const { district, venue, category } = props || {}
  const [lng, lat] = (f.geometry as any).coordinates as [number, number]
  const iconName = pickIconName(category)
  const iconUrl = `/icons/${iconName}.png`

  const wrap = document.createElement('div')
  wrap.className = 'pop-card'

  const hero = document.createElement('div')
  hero.className = 'pop-hero'
  const heroIcon = document.createElement('img')
  heroIcon.className = 'pop-hero__icon'
  heroIcon.src = iconUrl
  heroIcon.alt = iconName
  hero.appendChild(heroIcon)

  const body = document.createElement('div')
  body.className = 'pop-body'
  body.innerHTML = `
    <div class="pop-title">${venue || '(未命名場地)'}</div>
    <div class="pop-subtle">${district || ''}｜${category || ''}<br/>
      <small>${lat.toFixed(5)}, ${lng.toFixed(5)}</small>
    </div>
  `

  const tags = document.createElement('div')
  tags.className = 'pop-tags'
  const t1 = document.createElement('span'); t1.className='pop-tag'; t1.textContent='導航'
  const t2 = document.createElement('span'); t2.className='pop-tag'; t2.textContent='可計分場域'
  const t3 = document.createElement('span'); t3.className='pop-tag'; t3.textContent=(category||'').slice(0,10)
  tags.append(t1,t2,t3)

  const actions = document.createElement('div'); actions.className='pop-actions'
  const btnRoute = document.createElement('button'); btnRoute.className='pop-btn pop-btn--primary'; btnRoute.textContent='規劃路線'
  const btnSave  = document.createElement('button'); btnSave.className='pop-btn'; btnSave.textContent='加入清單'

  btnRoute.addEventListener('click', () => {
    const q = encodeURIComponent(`${lat},${lng}`)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank')
  })
  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true
    btnSave.textContent = '已加入 ✓'
    console.log('Saved:', { venue, lng, lat })
  })

  actions.append(btnRoute, btnSave)
  body.append(tags, actions)

  wrap.append(hero, body)
  return wrap
}

/* ===== Ripple（點擊漣漪動畫） ===== */
let rippleAnim: number | null = null
function startRippleAt(lng: number, lat: number) {
  if (!map) return
  if (!map.getSource(RIPPLE_SOURCE_ID)) {
    map.addSource(RIPPLE_SOURCE_ID, { type: 'geojson', data: { type:'FeatureCollection', features: [] } as any })
    map.addLayer({
      id: RIPPLE_LAYER_ID,
      type: 'circle',
      source: RIPPLE_SOURCE_ID,
      paint: { 'circle-color': '#6c5ce7', 'circle-opacity': 0.25, 'circle-radius': 6, 'circle-blur': 0.6 }
    })
  }
  ;(map.getSource(RIPPLE_SOURCE_ID) as mapboxgl.GeoJSONSource).setData({
    type:'FeatureCollection',
    features: [{ type:'Feature', geometry:{ type:'Point', coordinates:[lng,lat] }, properties:{} }]
  } as any)

  const start = performance.now()
  const DURATION = 1200, MIN_R = 6, MAX_R = 55
  if (rippleAnim) cancelAnimationFrame(rippleAnim)
  ;(function animate(t?: number){
    const now = t ?? performance.now()
    const prog = ((now - start) % DURATION) / DURATION
    const radius = MIN_R + (MAX_R - MIN_R) * prog
    const opacity = 0.35 * (1 - prog)
    map!.setPaintProperty(RIPPLE_LAYER_ID, 'circle-radius', radius)
    map!.setPaintProperty(RIPPLE_LAYER_ID, 'circle-opacity', opacity)
    rippleAnim = requestAnimationFrame(animate)
  })()
}

/* ===== Map 初始化 ===== */
onMounted(async () => {
  map = new mapboxgl.Map({
    container: mapEl.value!,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [121.535, 25.114],
    zoom: 14,
    attributionControl: false,
  })
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

  map.on('load', async () => {
    await ensureIconsLoaded() // 先把圖示載好

    if (!map!.getSource(SOURCE_ID)) {
      map!.addSource(SOURCE_ID, { type: 'geojson', data: geojson.value })
    }

    // 1) icon points
    if (!map!.getLayer(LAYER_ID)) {
      map!.addLayer({
        id: LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'icon-image': iconExpression,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.06, 14, 0.16, 18, 0.13],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      })
    }

    // 2) halo polygons
    updateHalo()

    applyFilter()
  })

  // 點擊：彈卡片 + 漣漪 + 規劃路線（沿用你的路線流程）
  map.on('click', LAYER_ID, async (e) => {
    const f = e.features?.[0]
    if (!f) return
    const dest = (f.geometry as any).coordinates as [number, number]

    // 美宣 popup + flyTo + 漣漪
    new mapboxgl.Popup({ offset: 14, closeOnClick: true, className: 'popup--elev' })
      .setLngLat(dest)
      .setDOMContent(buildPopupDOM(f))
      .addTo(map!)

    map!.flyTo({ center: dest, zoom: Math.max(map!.getZoom(), 15), speed: 0.9, curve: 1.5 })
    startRippleAt(dest[0], dest[1])

    // 你的原本路線邏輯
    try {
      const pos = await getCurrentPosition()
      const start: [number, number] = [pos.coords.longitude, pos.coords.latitude]
      if (!userMarker) userMarker = new mapboxgl.Marker({ color: '#2c9ae0' }).setLngLat(start).addTo(map!)
      else userMarker.setLngLat(start)
      if (!destMarker) destMarker = new mapboxgl.Marker({ color: '#ff7a7a' }).setLngLat(dest).addTo(map!)
      else destMarker.setLngLat(dest)
      const route = await fetchRoute(start, dest, 'walking')
      drawRoute(route)
      currentDest.value = dest
      const b = new mapboxgl.LngLatBounds()
      b.extend(start).extend(dest)
      map!.fitBounds(b, { padding: 60, maxZoom: 16 })
    } catch {
      alert('無法取得定位，路線未顯示。')
      clearRoute()
    }
  })

  map.on('mouseenter', LAYER_ID, () => { map!.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', LAYER_ID, () => { map!.getCanvas().style.cursor = '' })

  await loadDataset()
  selectedCats.value = [...categories.value]
  selectedDists.value = [...districts.value]
  
})

onBeforeUnmount(() => {
  if (rippleAnim) cancelAnimationFrame(rippleAnim)
  map?.remove()
})

/* ===== 視野與篩選 ===== */
function fitToData() {
  if (!map) return
  const b = new mapboxgl.LngLatBounds()
  geojson.value.features.forEach((f) => b.extend(f.geometry as any))
  if (!b.isEmpty()) map.fitBounds(b, { padding: 40, maxZoom: 16 })
}

function applyFilter() {
  if (!map) return
  const catFilter: any = ['in', ['get', 'category'], ['literal', selectedCats.value]]
  const distFilter: any = ['in', ['get', 'district'], ['literal', selectedDists.value]]
  const combined: any = ['all', catFilter, distFilter]

  if (map.getLayer(LAYER_ID)) map.setFilter(LAYER_ID, combined)
  if (map.getLayer(HALO_FILL_ID)) map.setFilter(HALO_FILL_ID, combined)
  if (map.getLayer(HALO_LINE_ID)) map.setFilter(HALO_LINE_ID, combined)

  map.once('idle', () => {
    if (!currentDest.value) return
    const [dx, dy] = currentDest.value
    const feats = map!.queryRenderedFeatures({ layers: [LAYER_ID] })
    const visible = feats.some((ft) => {
      const g = ft.geometry as any
      return Math.abs(g.coordinates[0] - dx) < 1e-7 && Math.abs(g.coordinates[1] - dy) < 1e-7
    })
    if (!visible) clearRoute()
  })
}
watch([selectedCats, selectedDists], applyFilter, { deep: true })

/* ===== 定位與路線 ===== */
function getCurrentPosition(options?: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('不支援地理定位'))
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options,
    })
  })
}

async function fetchRoute(start: [number, number], dest: [number, number], profile: 'walking' | 'driving' | 'cycling' = 'walking') {
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${start[0]},${start[1]};${dest[0]},${dest[1]}`)
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('overview', 'full')
  url.searchParams.set('access_token', MAPBOX_TOKEN)
  const r = await fetch(url.toString())
  if (!r.ok) throw new Error('Directions API 請求失敗')
  const d = await r.json()
  const geom = d.routes?.[0]?.geometry
  if (!geom) throw new Error('沒有可用路線')
  return geom as GeoJSON.LineString
}

function drawRoute(line: GeoJSON.LineString) {
  if (!map) return
  const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: line, properties: {} }] }
  if (map.getSource(ROUTE_SOURCE_ID)) {
    (map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(data)
    return
  }
  map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data })
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#2c9ae0', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [2, 2] },
  })
}

function clearRoute() {
  if (!map) return
  if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID)
  if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID)
  userMarker?.remove()
  destMarker?.remove()
  userMarker = destMarker = null
  currentDest.value = null
}
</script>

<template>
  <section class="page">
    <div class="map" ref="mapEl" />

    <!-- 左下角浮動按鈕 -->
    <button class="fab" @click="openFilter">篩選</button>

    <!-- 篩選彈窗 -->
    <FilterModal
      :open="modalOpen"
      :categories="categories"
      :districts="districts"
      :selectedCats="selectedCats"
      :selectedDists="selectedDists"
      @close="closeFilter"
      @confirm="confirmFilter"
    />
  </section>
</template>


<style scoped>
.page { position: relative; width: 100%; height: calc(100vh - 2rem); }
.map { width: 100%; height: 96%; }

/* 左下角浮動按鈕 */
.fab {
  position: absolute; left: 12px; bottom: 3rem;
  padding: .55rem .9rem; border-radius: 999px;
  border: 1px solid #d7dee3; background: #5ab4c5; backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  cursor: pointer; font-size: .95rem; color: #ffffff;
  z-index: 999;
}
</style>
