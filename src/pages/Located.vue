<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import FilterModal from '@/components/FilterModal.vue'

/* 這兩個就是你原本的狀態（預設全選） */
const selectedCats = ref<string[]>([])
const selectedDists = ref<string[]>([])

/* 你的 categories / districts 計算 property 仍沿用 */
const modalOpen = ref(false)

function openFilter() { modalOpen.value = true }
function closeFilter() { modalOpen.value = false }
function confirmFilter(payload: { cats: string[]; dists: string[] }) {
  selectedCats.value = payload.cats
  selectedDists.value = payload.dists
  modalOpen.value = false
  // 這裡不必手動呼叫 applyFilter()，因為你已用 watch(...) 監聽 selectedCats/selectedDists
}


mapboxgl.accessToken = 'pk.eyJ1IjoicGtib2llIiwiYSI6ImNtYXdxd2ljMjBrbDYybW9zc2JwZGg3bDYifQ.IO-4KpCrTxc-uVF1wIA6mw'

// ---- 模擬資料 ----
const raw = {
  data: {
    行政區: { 0: '士林區', 1: '士林區', 2: '士林區', 3: '士林區', 4: '士林區' },
    場地:   { 0: '天母運動場區', 1: '天母運動場區', 2: '天母運動場區', 3: '天母運動場區', 4: '天母運動場區' },
    類別:   { 0: '籃球場', 1: '籃球場', 2: '籃球場', 3: '籃球場', 4: '溜冰場' },
    緯度:   { 0: 25.1137, 1: 25.1137, 2: 25.1135, 3: 25.1135, 4: 25.1149 },
    經度:   { 0: 121.5345,1: 121.5347,2: 121.5345,3: 121.5347,4: 121.5334 }
  }
}

// ---- 轉 GeoJSON ----
function toGeoJSON(src: typeof raw) {
  const idxs = Object.keys(src.data.行政區)
  const features = idxs.map((k) => {
    const i = Number(k)
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [(src.data.經度 as any)[i], (src.data.緯度 as any)[i]] },
      properties: {
        district: (src.data.行政區 as any)[i],
        site: (src.data.場地 as any)[i],
        category: (src.data.類別 as any)[i]
      }
    }
  })
  return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection
}
const geojson = toGeoJSON(raw)

// ---- 篩選清單 ----
const categories = computed(() => {
  const s = new Set<string>(); geojson.features.forEach(f => s.add((f.properties as any).category))
  return Array.from(s)
})
const districts = computed(() => {
  const s = new Set<string>(); geojson.features.forEach(f => s.add((f.properties as any).district))
  return Array.from(s)
})


// ---- Mapbox ----
let map: mapboxgl.Map | null = null
const mapEl = ref<HTMLDivElement | null>(null)
const SOURCE_ID = 'sports-src'
const LAYER_ID = 'sports-pts'

const ROUTE_SOURCE_ID = 'route-src'
const ROUTE_LAYER_ID = 'route-line'
const currentDest = ref<[number, number] | null>(null)
// ===== 在頂部宣告 =====
let userMarker: mapboxgl.Marker | null = null
let destMarker: mapboxgl.Marker | null = null   // ★ 新增：目的地釘針


onMounted(() => {
  // 預設全選
  selectedCats.value = [...categories.value]
  selectedDists.value = [...districts.value]

  map = new mapboxgl.Map({
    container: mapEl.value!,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [121.535, 25.114],
    zoom: 14,
    attributionControl: false,
  })
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

  map.on('load', () => {
    if (!map!.getSource(SOURCE_ID)) {
      map!.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
    }
    if (!map!.getLayer(LAYER_ID)) {
      map!.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match', ['get', 'category'],
            '溜冰場', '#9b59b6',
            /* 其他類別 */ '#2c9ae0'
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      })
    }

    // 初始視野
    const b = new mapboxgl.LngLatBounds()
    geojson.features.forEach(f => b.extend(f.geometry as any))
    if (!b.isEmpty()) map!.fitBounds(b, { padding: 40, maxZoom: 16 })

    applyFilter()
  })

  // 點擊標點 → 詢問定位 → 畫路線（若拒絕不畫）
  map.on('click', LAYER_ID, async (e) => {
    const f = e.features?.[0]; if (!f) return
    const dest = (f.geometry as any).coordinates as [number, number]
    try {
      const pos = await getCurrentPosition()
      const start: [number, number] = [pos.coords.longitude, pos.coords.latitude]
      if (!userMarker) {
        userMarker = new mapboxgl.Marker({ color: '#2c9ae0' })
          .setLngLat(start)
          .addTo(map!)
      } else {
        userMarker.setLngLat(start)
      }
      if (!destMarker) {
        destMarker = new mapboxgl.Marker({ color: '#ff7a7a' })
          .setLngLat(dest)
          .addTo(map!)
      } else {
        destMarker.setLngLat(dest)
      }
      const route = await fetchRoute(start, dest, 'walking')
      drawRoute(route)
      currentDest.value = dest
      const b = new mapboxgl.LngLatBounds(); b.extend(start).extend(dest)
      map!.fitBounds(b, { padding: 60, maxZoom: 16 })

    } catch {
      alert('無法取得定位（可能拒絕或失敗），因此不顯示路徑。')
      clearRoute()
    }
    
  })

  map.on('mouseenter', LAYER_ID, () => { map!.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', LAYER_ID, () => { map!.getCanvas().style.cursor = '' })
  
})



onBeforeUnmount(() => { map?.remove() })

// ---- 動態套用雙篩選 ----
function applyFilter() {
  if (!map?.getLayer(LAYER_ID)) return

  // 類別條件（空陣列 = 全不顯示）
  const catFilter: any = ['in', ['get', 'category'], ['literal', selectedCats.value]]
  // 行政區條件（空陣列 = 全不顯示）
  const distFilter: any = ['in', ['get', 'district'], ['literal', selectedDists.value]]

  // 兩者同時成立
  const combined = ['all', catFilter, distFilter] as any
  map!.setFilter(LAYER_ID, combined)

  // 等這一輪渲染完成後再檢查可見性
  map!.once('idle', () => {
    if (!currentDest.value) return
    const [dx, dy] = currentDest.value
    const feats = map!.queryRenderedFeatures({ layers: [LAYER_ID] })
    const visible = feats.some((ft) => {
      const g = ft.geometry as any
      // 幾何是 Point，直接比對座標；留一點誤差容忍
      return Math.abs(g.coordinates[0] - dx) < 1e-7 &&
             Math.abs(g.coordinates[1] - dy) < 1e-7
    })
    if (!visible) clearRoute()  // ★ 標點消失 ⇒ 清除路徑
  })



}
watch([selectedCats, selectedDists], applyFilter, { deep: true })

/** 取得定位 */
function getCurrentPosition(options?: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('此裝置不支援地理定位'))
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options,
    })
  })
}

/** Directions 路線 */
async function fetchRoute(
  start: [number, number], dest: [number, number],
  profile: 'walking'|'driving'|'cycling' = 'walking'
) {
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${start[0]},${start[1]};${dest[0]},${dest[1]}`)
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('overview', 'full')
  url.searchParams.set('access_token', mapboxgl.accessToken)
  const r = await fetch(url.toString()); if (!r.ok) throw new Error('Directions API 請求失敗')
  const d = await r.json(); const geom = d.routes?.[0]?.geometry
  if (!geom) throw new Error('沒有可用路線'); return geom as GeoJSON.LineString
}

/** 畫路線（虛線藍色） */
function drawRoute(line: GeoJSON.LineString) {
  if (!map) return
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: line, properties: {} }]
  }
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
    paint: {
      'line-color': '#2c9ae0',
      'line-width': 4,
      'line-opacity': 0.9,
      'line-dasharray': [2, 2]
    }
  })
}

/** 清路線 */
function clearRoute() {
  if (!map) return
  if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID)
  if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID)
  if (userMarker) { userMarker.remove(); userMarker = null }
  if (destMarker) { destMarker.remove(); destMarker = null }   // ★ 新增
  currentDest.value = null
}


/* ===== 工具：全選 / 全不選 ===== */
function selectAllCats(all: boolean) {
  selectedCats.value = all ? [...categories.value] : []
}
function selectAllDists(all: boolean) {
  selectedDists.value = all ? [...districts.value] : []
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
.map { width: 100%; height: 80%; }

/* 左下角浮動按鈕 */
.fab {
  position: relative; left: 12px; top: 1rem;
  padding: .55rem .9rem; border-radius: 999px;
  border: 1px solid #d7dee3; background: #5ab4c5; backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  cursor: pointer; font-size: .95rem; color: #ffffff;
}
</style>
