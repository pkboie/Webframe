<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// 1) 你的 Mapbox Token（換成你自己的）
mapboxgl.accessToken = 'pk.eyJ1IjoicGtib2llIiwiYSI6ImNtYXdxd2ljMjBrbDYybW9zc2JwZGg3bDYifQ.IO-4KpCrTxc-uVF1wIA6mw'

// 2) 來源資料（可改為 prop 或 API 回傳）
const raw = {
  data: {
    行政區: { 0: '士林區', 1: '士林區', 2: '士林區', 3: '士林區', 4: '士林區' },
    場地:   { 0: '天母運動場區', 1: '天母運動場區', 2: '天母運動場區', 3: '天母運動場區', 4: '天母運動場區' },
    類別:   { 0: '籃球場1', 1: '籃球場2', 2: '籃球場3', 3: '籃球場4', 4: '溜冰場' },
    緯度:   { 0: 25.1137, 1: 25.1137, 2: 25.1135, 3: 25.1135, 4: 25.1149 },
    經度:   { 0: 121.5345,1: 121.5347,2: 121.5345,3: 121.5347,4: 121.5334 }
  }
}

// 3) 轉成 GeoJSON
function toGeoJSON(src: typeof raw) {
  const idxs = Object.keys(src.data.行政區)
  const features = idxs.map((k) => {
    const i = Number(k)
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [(src.data.經度 as any)[i], (src.data.緯度 as any)[i]]
      },
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

// 4) 取得所有「類別」清單 & 勾選狀態
const categories = computed(() => {
  const set = new Set<string>()
  geojson.features.forEach(f => set.add((f.properties as any).category))
  return Array.from(set)
})
const selected = ref<string[]>([]) // 預設全選在 mounted 後設定

// 5) Mapbox 初始化
let map: mapboxgl.Map | null = null
const mapEl = ref<HTMLDivElement | null>(null)
const SOURCE_ID = 'sports-src'
const LAYER_ID = 'sports-pts'

onMounted(() => {
  // 預設全選
  selected.value = [...categories.value]

  map = new mapboxgl.Map({
    container: mapEl.value!,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [121.535, 25.114], // 初始中心（台北士林附近）
    zoom: 14
  })

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

  map.on('load', () => {
    // 加資料源
    if (!map!.getSource(SOURCE_ID)) {
      map!.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson
      })
    }

    // 畫點
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
            /* 其他類別用這色 */ '#2c9ae0'
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      })
    }

    // 自動視野
    const bounds = new mapboxgl.LngLatBounds()
    geojson.features.forEach(f => bounds.extend(f.geometry as any))
    if (!bounds.isEmpty()) map!.fitBounds(bounds, { padding: 40, maxZoom: 16 })

    // 初次套用篩選
    applyFilter()
  })

  // 點擊顯示資訊
  map.on('click', LAYER_ID, (e) => {
    const f = e.features?.[0]
    if (!f) return
    const p = f.properties as any
    const html = `<strong>${p.site}</strong><br/>${p.district}<br/>類別：${p.category}`
    new mapboxgl.Popup().setLngLat((f.geometry as any).coordinates).setHTML(html).addTo(map!)
  })

  // 滑鼠樣式
  map.on('mouseenter', LAYER_ID, () => { map!.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', LAYER_ID, () => { map!.getCanvas().style.cursor = '' })
})

onBeforeUnmount(() => { map?.remove() })

// 6) 勾選更新 → 動態 Mapbox Filter
function applyFilter() {
  if (!map?.getLayer(LAYER_ID)) return
  // ["in", ["get","category"], ["literal", ["籃球場1","溜冰場"]]]
  map!.setFilter(LAYER_ID, ['in', ['get', 'category'], ['literal', selected.value]])
}
watch(selected, applyFilter)
</script>

<template>
  <section class="page">
    <div class="map" ref="mapEl" />

    <!-- 底部勾選條 -->
    <div class="filter-bar">
      <div class="bar-title">顯示類別</div>
      <div class="checks">
        <label v-for="c in categories" :key="c" class="check">
          <input
            type="checkbox"
            :value="c"
            v-model="selected"
          />
          <span>{{ c }}</span>
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  position: relative;
  width: 100%;
  height: calc(100vh - 64px); /* 視需要扣掉你的 NaviBar 高度 */
  font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif;
}
.map {
  width: 100%;
  height: 100%;
}

/* 底部 Filter Bar */
.filter-bar {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,.95);
  border-top: 1px solid #eee;
  backdrop-filter: blur(6px);
  padding: .5rem .75rem .75rem;
}

.bar-title {
  font-size: .875rem;
  color: #555;
  margin-bottom: .25rem;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem .75rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  font-size: .95rem;
  color: #333;
}

.check input {
  accent-color: #2c9ae0; /* 勾選色 */
}
</style>
