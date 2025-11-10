<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
/* ===== API base ===== */
const API_BASE = (import.meta.env.VITE_API_BASE as string) || ''
const MERCH_URL    = `${API_BASE}/api/merch`
const PURCHASE_URL = `${API_BASE}/api/purchase`
const POINTS_URL   = `${API_BASE}/api/points/me`
const showErrorDialog = ref(false)
const errorMessage = ref('')

/* ===== 型別 ===== */
type ApiRow = {
  id: number
  productName: string
  price: number
  pictureURL: string
  tag: 'food' | 'travel' | 'entertain'
}
type ApiResp = { data: ApiRow[] }

type Product = {
  id: number
  name: string
  points: number
  image: string
  food: boolean
  travel: boolean
  entertain: boolean
}

/* ===== 狀態 ===== */
const showDialog = ref(false)
const success = ref(false)
const selectedProduct = ref<Product | null>(null)

const products = ref<Product[]>([])
const loading = ref(false)
const errorMsg = ref<string | null>(null)

const points = ref<number>(0)          // 目前點數
const purchasing = ref<boolean>(false) // 購買中

/* ===== 工具 ===== */
function buildHeaders(base: Record<string, string> = {}) {
  const { authHeader } = useAuth()
  const { Authorization } = authHeader() as { Authorization?: string }
  return {
    ...base,
    ...(Authorization ? { Authorization } : {}),
  } as HeadersInit
}


function normalizeImg(url: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  // 統一走後端 /assets/（你有 VITE_API_BASE）
  const clean = url.replace(/^\.?\/*assets\/*/, '')
  return `${API_BASE}/assets/${clean}`
}

/* ===== 拉商品 ===== */
async function loadMerch() {
  loading.value = true
  errorMsg.value = null
  try {
    const r = await fetch(MERCH_URL, {
  headers: buildHeaders({ Accept: 'application/json' })
})
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = (await r.json()) as ApiResp
    const rows = Array.isArray(j.data) ? j.data : []

    products.value = rows.map(row => ({
      id: row.id,
      name: row.productName,
      points: row.price,
      image: normalizeImg(row.pictureURL),
      food: row.tag === 'food',
      travel: row.tag === 'travel',
      entertain: row.tag === 'entertain',
    }))
  } catch (e: any) {
    errorMsg.value = e?.message ?? '讀取失敗'
    products.value = []
  } finally {
    loading.value = false
  }
}

/* ===== 拉 points ===== */
async function fetchPoints() {
  const { authHeader } = useAuth()
  const r = await fetch(POINTS_URL, {
  headers: buildHeaders()
})
  if (!r.ok) throw new Error(`points GET HTTP ${r.status}`)

  // Swagger 標成 "string"，這裡做兼容解析
  const raw = await r.text()
  try {
    const j = JSON.parse(raw)
    if (typeof j === 'number') { points.value = j; return }
    if (j && typeof j.points === 'number') { points.value = j.points; return }
  } catch {}
  // 純數字字串
  const n = Number(raw)
  points.value = Number.isFinite(n) ? n : 0
}

/* ===== 篩選與對話框 ===== */
type Tag = 'all' | 'food' | 'travel' | 'entertain'
const currentTag = ref<Tag>('all')

const filteredProducts = computed(() => {
  if (currentTag.value === 'all') return products.value

  // 縮小成不含 'all' 的鍵
  type ValidTag = Exclude<Tag, 'all'>
  const key = currentTag.value as ValidTag

  return products.value.filter(p => p[key])
})




const openConfirm = (p: Product) => {
  selectedProduct.value = p
  success.value = false
  showDialog.value = true
}
const closeDialog = () => { showDialog.value = false }

const setFilter = (t: Tag) => {
  currentTag.value = t
}

/* ===== 購買（兌換） ===== */
const confirmRedeem = async () => {
  if (!selectedProduct.value || purchasing.value) return
  purchasing.value = true
  try {
    const body = {
      item_id:  selectedProduct.value.id,
      count:    1,
      timestamp: new Date().toISOString(),
    }
    const r = await fetch(PURCHASE_URL, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })

    if (!r.ok) {
      // 嘗試讀取後端錯誤訊息
      let msg = `purchase HTTP ${r.status}`
      try {
        const txt = await r.text()
        const j = JSON.parse(txt)
        msg = j?.detail || j?.message || txt || msg
      } catch {}
      throw new Error(msg)
    }

    // 刷新 points
    await fetchPoints()

    // ✅ 成功動畫（沿用你的 success 對話框）
    success.value = true
    setTimeout(() => { showDialog.value = false }, 1500)
  } catch (e: any) {
    console.error(e)
    // ❌ 失敗：關閉確認對話框，改開錯誤彈窗
    showDialog.value = false
    errorMessage.value = e?.message || '兌換失敗，請稍後再試'
    showErrorDialog.value = true
  } finally {
    purchasing.value = false
  }
}


/* ===== 啟動 ===== */
onMounted(async () => {
  // 同步載入商品與點數，但點數失敗不影響頁面
  const results = await Promise.allSettled([loadMerch(), fetchPoints()])
  const pointsResult = results[1]
  if (pointsResult && pointsResult.status === 'rejected') {
    console.error('fetchPoints failed', pointsResult.reason)
    // 如果抓分數失敗，不影響頁面顯示
  }
})

</script>


<template>
  <!-- 目前點數 -->
  <div class="points-left">
    <span class="points-title">目前點數：{{ points }}</span>
  </div>

  <div class="redeem-page">
    <!-- 商品區塊 -->
    <div class="product-container">
      <div class="product-grid">
        <div
          v-for="p in filteredProducts"
          :key="p.id"
          class="product-card"
          @click="openConfirm(p)"
        >
          <img :src="p.image" alt="商品圖片" class="product-image" />
          <div class="product-info">
            <h3>{{ p.name }}</h3>
            <p>{{ p.points }} 點</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部選單 -->
    <div class="bottom-nav">
      <div
        class="nav-item"
        :class="{ active: currentTag === 'all' }"
        @click="setFilter('all')"
      >
        全部
      </div>
      <div
        class="nav-item"
        :class="{ active: currentTag === 'food' }"
        @click="setFilter('food')"
      >
        飲食
      </div>
      <div
        class="nav-item"
        :class="{ active: currentTag === 'travel' }"
        @click="setFilter('travel')"
      >
        出行
      </div>
      <div
        class="nav-item"
        :class="{ active: currentTag === 'entertain' }"
        @click="setFilter('entertain')"
      >
        娛樂
      </div>
    </div>

    <!-- 彈出視窗 -->
    <!-- 彈出視窗：確認/成功 -->
    <div v-if="showDialog" class="dialog-overlay">
      <div class="dialog-box">
        <p v-if="!success">是否兌換「{{ selectedProduct?.name }}」？</p>
        <p v-else class="success">兌換成功！</p>

        <div class="dialog-buttons" v-if="!success">
          <button class="confirm" :disabled="purchasing" @click="confirmRedeem">
            {{ purchasing ? '處理中...' : '確定' }}
          </button>
          <button class="cancel" :disabled="purchasing" @click="closeDialog">取消</button>
        </div>
      </div>
    </div>

    <!-- ❌ 錯誤彈窗 -->
    <div v-if="showErrorDialog" class="dialog-overlay" @click="showErrorDialog=false">
      <div class="dialog-box error" @click.stop>
        <h3>兌換失敗</h3>
        <div class="dialog-buttons">
          <button class="confirm" @click="showErrorDialog=false">我知道了</button>
        </div>
      </div>
    </div>

  </div>
</template>



<style scoped>
/* 讓圖示跟文字差不多大，隨字體大小縮放 */
.points-left { 
  display: flex; 
  align-items: baseline;   /* 與數字/文字的基線對齊 */
  gap: 10px;
  font-size: 16px;         /* 你也可以用 clamp() 做自適應 */
}

.points-title{
  font-weight: 800;
  color: #123053;
  letter-spacing: .2px;
  white-space: nowrap;
  line-height: 1.2;
}

/* 關鍵：用 em 當單位，隨字體大小一起變動 */
.points-icon{
  width: 1.15em;           /* 跟文字等高，微微大一點看起來更剛好 */
  height: 1.15em;
  object-fit: contain;
  vertical-align: baseline; /* 和字的基線對齊 */
  transform: translateY(1px); /* 微調，讓視覺更居中；可視需要 ±1px */
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.10));
}

.redeem-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f9f9f9;
}

.product-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.product-card {
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  text-align: center;
  transition: transform 0.2s;
  cursor: pointer;
}

.product-card:hover {
  transform: scale(1.03);
}

.product-image {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.product-info {
  padding: 0.5rem;
}

.bottom-nav {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid #ddd;
  background: white;
  height: 3rem;
  align-items: center;
  font-weight: bold;
  position: sticky;
  bottom: 0;
}

.nav-item {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  cursor: pointer;
  transition: 0.3s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.nav-item.active {
  color: #00bfff;
  border-top: 3px solid #00bfff;
}

.nav-item:hover {
  background: #f0f0f0;
}

/* 彈窗樣式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}

.dialog-box {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  width: 280px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}

.dialog-buttons {
  display: flex;
  justify-content: space-around;
  margin-top: 1rem;
}

.dialog-buttons button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: 0.2s;
}

.confirm {
  background-color: #00bfff;
  color: white;
}

.cancel {
  background-color: #ccc;
}

.confirm:hover {
  background-color: #0099cc;
}

.cancel:hover {
  background-color: #aaa;
}

.success {
  color: #00bfff;
  font-weight: bold;
}
</style>