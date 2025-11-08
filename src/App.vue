<script setup>
import { onMounted } from 'vue'
import NaviBar from './components/NaviBar.vue'
import MapView from './components/MapView.vue'
import LoginWidget from './components/LoginWidget.vue'
  
onMounted(() => {
  console.log('App component mounted')
})
</script>

<template>
  <div id="app">
    <LoginWidget />
    <NaviBar />
    <main>
      <!-- <RouterView /> -->
      <RouterView />
      
    </main>
  </div>
</template>

<style scoped>
l{
  color: red;
}
main{
  margin: 0;
  padding: 0;
}
</style>

