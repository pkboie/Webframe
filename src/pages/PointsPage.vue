<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { sendPresence } from '@/api/presence'
import { useAuth } from '@/composables/useAuth'

const sending = ref(false)
const message = ref('')

const points = ref<number | null>(null)        // 後端的真實分數
const displayPoints = ref<number>(0)           // 畫面顯示（做補間動畫）
const lastUpdate = ref<string>('-')

const { authHeader } = useAuth()

/** ========= 傳送定位（按鈕觸發） ========= */
async function handleSend() {
  message.value = ''
  sending.value = true

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lng = pos.coords.longitude
    const lat = pos.coords.latitude
    const now = new Date().toISOString()

    try {
      await sendPresence({
        user_id: 'USER_001',
        lng,
        lat,
        timestamp: now,
      })
      message.value = `✅ 已送出 (${lng.toFixed(4)}, ${lat.toFixed(4)})`
    } catch (err) {
      console.error(err)
      message.value = '❌ 傳送失敗'
    } finally {
      sending.value = false
    }
  }, 
  (err) => {
    message.value = '❌ 無法取得定位權限'
    sending.value = false
  })
}

/** ========= 定時抓分 ========= */
let timer: number | null = null
async function fetchPoints() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/points/me`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const newPoints = Number(data.points ?? 0)

    // 第一次：直接同步
    if (points.value === null) {
      points.value = newPoints
      displayPoints.value = newPoints
    } else {
      const old = points.value
      const diff = newPoints - old
      points.value = newPoints
      if (diff !== 0) {
        triggerDelta(diff)
        animateNumber(displayPoints.value, newPoints, 500)
        flashOn.value = false; void nextTickToggleFlash()
      }
    }

    const t = new Date()
    lastUpdate.value = t.toLocaleTimeString('zh-TW', { hour12: false })
  } catch (err) {
    console.error('❌ 抓取分數失敗：', err)
  }
}

onMounted(() => {
  fetchPoints()
  timer = window.setInterval(fetchPoints, 5000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  cancelAnim()
})

/** ========= 分數動畫：數字補間/閃爍/漂浮徽章 ========= */
let rafId: number | null = null
function cancelAnim() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

/** 補間 displayPoints 到目標值 */
function animateNumber(from: number, to: number, duration = 500) {
  cancelAnim()
  const start = performance.now()
  const delta = to - from
  const ease = (x: number) => 1 - Math.pow(1 - x, 3) // easeOutCubic

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    displayPoints.value = Math.round(from + delta * ease(t))
    if (t < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      rafId = null
      displayPoints.value = to
    }
  }
  rafId = requestAnimationFrame(step)
}

/** 閃爍效果 */
const flashOn = ref(false)
function nextTickToggleFlash() {
  // 讓 class 重新觸發動畫（移除->下一輪微任務->加回）
  requestAnimationFrame(() => {
    flashOn.value = true
    // 動畫結束自動還原（對應 CSS 動畫 600ms）
    setTimeout(() => (flashOn.value = false), 620)
  })
}

/** 漂浮徽章（+5 / -3） */
const deltaText = ref<string>('')
const deltaVisible = ref(false)
function triggerDelta(diff: number) {
  deltaText.value = diff > 0 ? `+${diff}` : `${diff}`
  deltaVisible.value = false // 先關閉一次，確保重播動畫
  void Promise.resolve().then(() => {
    deltaVisible.value = true
    setTimeout(() => (deltaVisible.value = false), 800) // 與動畫時長對齊
  })
}
</script>

<template>
  <div class="presence">
    <h2>📍 使用者狀態上報</h2>

    <button @click="handleSend" :disabled="sending">
      {{ sending ? '傳送中…' : '傳送目前位置' }}
    </button>

    <p class="msg">{{ message }}</p>

    <div class="status">
      <div class="points-line">
        <span>🪙 當前分數：</span>

        <!-- 分數數字：會閃爍＆平滑補間 -->
        <span class="points-value" :class="{ flash: flashOn }">
          {{ displayPoints }}
        </span>

        <!-- 漂浮徽章：在數字右上角飄起來 -->
        <span
          v-if="deltaVisible"
          class="delta-badge"
          :class="{ up: deltaText.startsWith('+'), down: deltaText.startsWith('-') }"
        >
          {{ deltaText }}
        </span>
      </div>

      <p>⏰ 上次更新：<strong>{{ lastUpdate }}</strong></p>
    </div>
  </div>
</template>

<style scoped>
.presence {
  max-width: 460px;
  margin: 2rem auto;
  padding: 1.5rem;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  text-align: center;
  font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
}
button {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  background: #2c9ae0;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  transition: 0.2s;
}
button:hover:not([disabled]) { background: #208bc7; }
button[disabled] { opacity: 0.6; cursor: not-allowed; }

.status {
  margin-top: 1.25rem;
  background: #f7faff;
  border-radius: 8px;
  padding: 0.9rem;
}

/* 分數行：為了擺放漂浮徽章，做相對定位 */
.points-line {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  font-size: 1.05rem;
}

/* 分數數字 */
.points-value {
  font-weight: 700;
  font-size: 1.35rem;
  color: #274b66;
}
.points-value.flash {
  animation: flash 0.6s ease;
}
@keyframes flash {
  0%   { color: #274b66; text-shadow: none; }
  25%  { color: #1186d4; text-shadow: 0 0 6px rgba(17,134,212,.35); }
  100% { color: #274b66; text-shadow: none; }
}

/* 漂浮徽章 (+5/-3) */
.delta-badge {
  position: absolute;
  right: -24px;         /* 在數字右側 */
  top: -6px;            /* 稍微靠上 */
  font-weight: 700;
  font-size: .95rem;
  opacity: 0;
  transform: translateY(0);
  pointer-events: none;
  animation: floatUp .8s ease forwards;
}
.delta-badge.up { color: #22a946; }     /* 漲分：綠色 */
.delta-badge.down { color: #e44; }      /* 減分：紅色 */

@keyframes floatUp {
  0%   { transform: translateY(6px); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateY(-14px); opacity: 0; }
}

.msg { color: #444; margin-top: 0.75rem; }
</style>
