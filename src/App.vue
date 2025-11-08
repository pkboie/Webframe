<script setup>
import { onMounted } from 'vue'
import NaviBar from './components/NaviBar.vue'
import MapView from './components/MapView.vue'

onMounted(() => {
  console.log('App component mounted')
})
</script>

<template>
  <div id="app">
    <NaviBar />
    <main>
      <MapView />
    </main>
  </div>
</template>

<style scoped>
body {
  margin: 0;
  padding: 0;
}
l{
  color: red;
}
</style>

