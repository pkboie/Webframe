<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
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
const ROUTE_SOURCE_ID = 'route-src'
const ROUTE_LAYER_ID = 'route-line'

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
          site: item.場地,
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

  map.on('load', () => {
    if (!map!.getSource(SOURCE_ID)) map!.addSource(SOURCE_ID, { type: 'geojson', data: geojson.value })
    if (!map!.getLayer(LAYER_ID)) {
      map!.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'category'],
            '溜冰場', '#9b59b6',
            /* default */ '#2c9ae0',
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      })
    }
    applyFilter()
  })

  map.on('click', LAYER_ID, async (e) => {
    const f = e.features?.[0]
    if (!f) return
    const dest = (f.geometry as any).coordinates as [number, number]
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

onBeforeUnmount(() => map?.remove())

/* ===== 視野與篩選 ===== */
function fitToData() {
  if (!map) return
  const b = new mapboxgl.LngLatBounds()
  geojson.value.features.forEach((f) => b.extend(f.geometry as any))
  if (!b.isEmpty()) map.fitBounds(b, { padding: 40, maxZoom: 16 })
}

function applyFilter() {
  if (!map?.getLayer(LAYER_ID)) return
  const catFilter: any = ['in', ['get', 'category'], ['literal', selectedCats.value]]
  const distFilter: any = ['in', ['get', 'district'], ['literal', selectedDists.value]]
  map!.setFilter(LAYER_ID, ['all', catFilter, distFilter])
  map!.once('idle', () => {
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
}
</style>
