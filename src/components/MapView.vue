<script setup lang="ts">
import { onMounted, ref } from 'vue'
import mapboxgl from 'mapbox-gl'

// 🗝️ 設定你的 Mapbox Token
mapboxgl.accessToken = 'pk.eyJ1IjoicGtib2llIiwiYSI6ImNtYXdxd2ljMjBrbDYybW9zc2JwZGg3bDYifQ.IO-4KpCrTxc-uVF1wIA6mw'

const mapContainer = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if (!mapContainer.value) return
  const map = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v12', // 其他樣式: light-v11, dark-v11, satellite-v9
    center: [121.5654, 25.033], // 台北經緯度
    zoom: 11,
  })

  // 加上地標
  new mapboxgl.Marker({ color: 'red' })
    .setLngLat([121.5654, 25.033])
    .setPopup(new mapboxgl.Popup().setText('台北市中心'))
    .addTo(map)
})
</script>

<template>
  <div ref="mapContainer" class="map-container"></div>
</template>

<style scoped>
.map-container {
width: 100%;
height: 80vh;
border-radius: 0;
overflow: hidden;
}
</style>
