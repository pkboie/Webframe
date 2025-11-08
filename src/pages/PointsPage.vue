<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getDataset } from '@/services/dataset'

const loading = ref(false)
const error = ref<string | null>(null)
const payload = ref<any>(null)

onMounted(async () => {
  loading.value = true
  try {
    const data = await getDataset()
    payload.value = data
    console.log('Dataset loaded:', data)
  } catch (e: any) {
    error.value = e?.message ?? '發生錯誤'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <button @click="($forceUpdate(),0)">重新整理</button>
    <div v-if="loading">載入中…</div>
    <div v-else-if="error">錯誤：{{ error }}</div>
    <pre v-else>{{ payload }}</pre>
  </div>
</template>
