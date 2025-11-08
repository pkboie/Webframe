<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/composables/useAuth'

/* ===== Config ===== */
const API_BASE   = import.meta.env.VITE_API_BASE as string
const API_PATH   = '/api/pressence'               // 若後端是 /api/presence 就改這裡
const POLL_MS    = 5000                           // 每次輪詢間隔
const POINTS_URL = `${API_BASE}/api/points/me`

/* ===== UI State ===== */
const isActive  = ref(false)
const showPlus  = ref(false)
const randomX   = ref(0)
const randomDir = ref(1)

/* ===== Points & Polling ===== */
const score  = ref(0)
let pollId: number | null = null
let hidePlusTid: number | null = null

// 避免重疊與過期 tick
let runSeq = 0;           // 每次 start/stop 會遞增，舊 tick 自動失效
let inFlight = false;     // 正在執行中的 pollOnce
let rerunNeeded = false;  // 執行中若又到點，收尾後補跑一次

function isPolling() { return pollId !== null }

function toggleColor() {
  if (isPolling()) stopAll()
  else startAll()
}

function startAll() {
  isActive.value = true
  const seq = ++runSeq

  // 先抓一次分數（非致命）
  fetchPoints().catch((e) => console.error(e))

  // 先跑一次，再固定間隔
  pollOnce(seq)
  pollId = window.setInterval(() => pollOnce(seq), POLL_MS)
}

function stopAll() {
  runSeq++ // 讓既有/等待中的 tick 作廢
  if (pollId) { clearInterval(pollId); pollId = null }
  stopFloating()
  isActive.value = false
}

/* ===== Animations ===== */
function stopFloating() {
  if (hidePlusTid) { clearTimeout(hidePlusTid); hidePlusTid = null }
  showPlus.value = false
}

const ANIM_COOLDOWN_MS = 4000
let lastAnimAt = 0
function triggerPlusOne() {
  const now = Date.now()
  if (now - lastAnimAt < ANIM_COOLDOWN_MS) return // 4 秒內只播一次
  lastAnimAt = now

  randomX.value  = Math.random() * 100 + 50
  randomDir.value = Math.random() > 0.5 ? 1 : -1
  showPlus.value = true
  if (hidePlusTid) clearTimeout(hidePlusTid)
  hidePlusTid = window.setTimeout(() => (showPlus.value = false), 3500)
}

/* ===== Points API ===== */
async function fetchPoints() {
  const { authHeader } = useAuth()
  const r = await fetch(POINTS_URL, { headers: { ...authHeader() } })
  if (!r.ok) throw new Error(`points GET HTTP ${r.status}`)

  // 兼容：純數字 / {"points":123} / {"data":{"points":123}}
  const raw = await r.text()
  try {
    const j = JSON.parse(raw)
    if (typeof j === 'number')               { score.value = j; return }
    if (j && typeof j.points === 'number')   { score.value = j.points; return }
    if (j?.data && typeof j.data.points === 'number') { score.value = j.data.points; return }
  } catch {}
  const n = Number(raw)
  score.value = Number.isFinite(n) ? n : 0
}

/* ===== Presence + Points (one fetchPoints per tick) ===== */
async function pollOnce(seq: number) {
  if (seq !== runSeq) return           // 過期
  if (inFlight) { rerunNeeded = true; return } // 避免重疊
  inFlight = true

  try {
    const { authHeader } = useAuth()

    // 1) 定位
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('此裝置不支援地理定位'))
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10_000, maximumAge: 0,
      })
    })
    if (seq !== runSeq) return

    // 2) Presence
    const payload = {
      user_id: 'USER_001',
      lng: pos.coords.longitude,
      lat: pos.coords.latitude,
      timestamp: new Date().toISOString(),
    }
    const res = await fetch(`${API_BASE}${API_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`presence HTTP ${res.status}`)
    if (seq !== runSeq) return

    const data: { status: 'success'|'error'; inRange: boolean } = await res.json()
    if (seq !== runSeq) return

    // 3) ★ 每個 tick 僅呼叫一次 fetchPoints（無論 inRange 與否）
    try { await fetchPoints() } catch (e) { console.error(e) }
    if (seq !== runSeq) return

    // 4) 不在範圍 → 立即停止（本 tick 的 fetchPoints 已完成）
    if (!data.inRange) { stopAll(); return }

    // 5) 在範圍 → 播一次動畫（含 4s 冷卻）
    isActive.value = true
    triggerPlusOne()

  } catch (e) {
    console.error('pollOnce failed:', e)
    stopAll()
  } finally {
    inFlight = false
    if (rerunNeeded && seq === runSeq) {
      rerunNeeded = false
      queueMicrotask(() => pollOnce(seq)) // 補跑一次，仍屬同一序列
    }
  }
}

/* ===== Lifecycle ===== */
onMounted(() => {
  // 進頁即抓一次分數
  fetchPoints().catch((e) => console.error(e))
})

onUnmounted(() => {
  stopAll()
})
</script>


<template>
  <div class="btn" :class="{ active: isActive }">
    <!-- 分數顯示 -->
    <div class="score">{{ score }}</div>

    <!-- +1 漂浮效果 -->
    <transition name="float">
      <div
        v-if="showPlus"
        class="plusOne"
        :style="{ '--x': randomX + 'px', '--dir': randomDir as any }"
      >
        +1
      </div>
    </transition>

    <!-- 主按鈕 -->
    <button 
      class="go-button" 
      :class="{ active: isActive }" 
      @click="toggleColor">
      GO
      <span v-if="isActive" class="pulse layer1"></span>
      <span v-if="isActive" class="pulse layer2"></span>
    </button>
  </div>
</template>

<style scoped>
/* --- 背景 --- */
.btn {
  position: relative;
  width: 100vw;
  height: calc(100vh - 60px);
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
  overflow: hidden;
}

.btn::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, #4aa1b2, #e8f6f8, #4aa1b2);
  opacity: 0;
  transition: opacity 1.8s ease-in-out;
  z-index: 0;
}

.btn.active::before {
  opacity: 1;
  animation: breathing 5s ease-in-out infinite;
}

@keyframes breathing {
  0% { filter: brightness(0.9); }
  50% { filter: brightness(1.05); }
  100% { filter: brightness(0.9); }
}

.score {
  position: absolute;
  top: 15%;
  font-size: 96px;
  font-weight: bold;
  color: #333;
  z-index: 1;
}

/* --- 按鈕 --- */
.go-button {
  position: relative;
  overflow: visible;
  width: 80vw;
  height: 15vh;
  font-size: 50px;
  font-weight: bold;
  color: white;
  background-color: gray;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.8s ease-in-out;
  z-index: 2;
}

.go-button.active {
  background-color: #58d2eb;
  filter: brightness(1);
}

/* --- +1 漂浮 --- */
.plusOne {
  position: absolute;
  bottom: 50%; /* 從按鈕中間開始 */
  font-size: 48px;
  font-weight: bold;
  color: #ffffff;
  opacity: 0;
  animation: floatDrift 5s ease-in-out forwards;
  z-index: 0;
}

/* 飄浮動畫 — 垂直上升 + 左右漂浮 */
@keyframes floatDrift {
  0% {
    transform: translate(calc(var(--dir) * var(--x) * 0.5), 0vh);
    opacity: 0;
  }
  30% { opacity: 1; }
  100% {
    transform: translate(calc(var(--dir) * var(--x) * 1.5), -60vh);
    opacity: 1;
  }
}

/* --- 心跳漣漪 --- */
.pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 220%;
  height: 220%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
  animation: pulseWave 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
.layer2 { animation-delay: 1.5s; }

@keyframes pulseWave {
  0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.8; }
  25% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.6; }
  50% { transform: translate(-50%, -50%) scale(1.6); opacity: 0.4; }
  75% { transform: translate(-50%, -50%) scale(2.1); opacity: 0.2; }
  100% { transform: translate(-50%, -50%) scale(2.7); opacity: 0; }
}
</style>
