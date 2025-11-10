<template>
  <div class="leaderboard-card">
    <!-- Top bar -->
    <div class="lb-topbar">
      <div class="lb-title">
        <span class="dot"></span>
        Taipei Sports — Leaderboard
      </div>
      <div class="lb-subtitle">
        User: {{ displayUserName }}
      </div>
      <div class="lb-subtitle"></div>
    </div>


    <!-- 使用者列（始終顯示本人，不在榜上則 rank 顯示 —、score 顯示 0） -->
    <div
      class="User grid-3"
      :class="{ highlight: isUserHighlighted }"
      ref="userRow"
    >
      <div class="rank-col">{{ userView.rank || '—' }}</div>
      <div class="name-col">{{ userView.name }}</div>
      <div class="score-col">
        <div class="score-num">
          {{ userView.score }}
        </div>
      </div>
    </div>

    <!-- 標題列 -->
    <div class="headerRow grid-3">
      <div class="rank-col">Rank</div>
      <div class="name-col">Name</div>
      <div class="score-col">Score</div>
    </div>

    <!-- 排行榜內容 -->
    <div class="rankDisplay" ref="rankDisplay" @scroll="handleScroll">
      <div
        v-for="p in displayedPlayers"
        :key="p.name"
        class="player grid-3"
        :class="[ p.name === userView.name ? 'userRow' : '', medalClass(p.rank) ]"
      >
        <div class="rank-col">{{ p.rank }}</div>

        <div class="name-col">
          <div class="name-wrapper">
            <span class="crown" v-if="p.rank === 1">👑</span>
            <span class="crown silver" v-else-if="p.rank === 2">👑</span>
            <span class="crown bronze" v-else-if="p.rank === 3">👑</span>
            <span class="name-text">{{ p.name }}</span>
          </div>
        </div>

        <div class="score-col">
          <div class="score-num">{{ p.score }}</div>
          <div class="score-bar">
            <div class="score-bar__fill" :style="{ width: scorePct(p.score) + '%' }"></div>
          </div>
        </div>
      </div>

      <div v-if="displayedPlayers.length === 0" class="empty">
        No players yet — go play & earn points!
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue'
import { useAuth } from '@/composables/useAuth'

/* ===== API ===== */
const API_BASE = (import.meta.env.VITE_API_BASE as string) || ''
const GET_ALL_SCORES_URL = `${API_BASE}/api/getallscores`

type ApiRow = { id: number; Username: string; Points: number }
type ApiResp = { data: ApiRow[] }
type Player = { rank: number; name: string; score: number }

/* ===== 狀態 ===== */
const loading = ref(false)
const errorMsg = ref<string | null>(null)

/** 排行資料（映射後） */
const allPlayers = shallowRef<Player[]>([])

/* ===== 從登入資訊推測本人名稱 ===== */
const { authHeader } = useAuth()
const ah = authHeader() as any
const myName = ref<string>(ah?.username || ah?.user || ah?.name || '—')

/** 在排行榜中找「本人」；找不到回 null */
const currentUserOnBoard = computed<Player | null>(() => {
  return allPlayers.value.find(p => p.name === myName.value) ?? null
})

/** 畫面顯示的使用者列：永遠顯示本人（沒上榜 rank=0, score=0） */
const userView = computed<Player>(() => {
  const found = currentUserOnBoard.value
  return {
    name: myName.value || '—',
    rank: found?.rank ?? 0,
    score: found?.score ?? 0,
  }
})

/** Topbar 顯示名稱 */
const displayUserName = computed(() => userView.value.name)

/** 顯示前 N 名；資料量不大時直接全顯示 */
const displayedPlayers = computed(() => {
  const data = allPlayers.value
  return data.length > 100 ? data.slice(0, 100) : data
})

/* ===== UI 輔助 ===== */
const maxScore = computed(() =>
  Math.max(...displayedPlayers.value.map(p => p.score || 0), 1)
)
const scorePct = (s: number) => Math.round((s / maxScore.value) * 100)
const medalClass = (rank: number) =>
  rank === 1 ? 'is-gold' : rank === 2 ? 'is-silver' : rank === 3 ? 'is-bronze' : ''

/* ===== 使用者列高亮判定 ===== */
const isUserHighlighted = ref(false)
const rankDisplay = ref<HTMLElement | null>(null)
const userRow = ref<HTMLElement | null>(null)

const handleScroll = () => {
  if (!userRow.value || !rankDisplay.value) return
  const userTop = userRow.value.getBoundingClientRect().top
  const listRect = rankDisplay.value.getBoundingClientRect()
  isUserHighlighted.value = userTop >= listRect.top && userTop <= listRect.bottom
}

/* ===== 將 /getallscores 轉為 Player[] ===== */
function mapApiToPlayers(rows: ApiRow[]): Player[] {
  const clean = rows
    .filter(r => r && typeof r.Username === 'string' && Number.isFinite(r.Points))
    .map(r => ({ name: r.Username, score: Number(r.Points) }))

  clean.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name))
  return clean.map((p, i) => ({ rank: i + 1, ...p }))
}

/* ===== 抓取排行榜並更新 ===== */
async function fetchAllScores() {
  loading.value = true
  errorMsg.value = null
  try {
    // 用 Headers 實例避免把 undefined 塞進去
    const headers = new Headers()
    headers.set('Accept', 'application/json')
    if (typeof ah?.Authorization === 'string') headers.set('Authorization', ah.Authorization)
    else if (typeof ah?.authorization === 'string') headers.set('Authorization', ah.authorization)

    const r = await fetch(GET_ALL_SCORES_URL, { headers })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)

    const j = (await r.json()) as ApiResp
    const rows: ApiRow[] = Array.isArray(j?.data) ? j.data : []

    allPlayers.value = mapApiToPlayers(rows)
  } catch (e: any) {
    errorMsg.value = e?.message ?? '讀取排行榜失敗'
    allPlayers.value = []
  } finally {
    loading.value = false
    requestAnimationFrame(() => handleScroll())
  }
}

/* ===== 生命週期 ===== */
onMounted(() => {
  fetchAllScores()
  requestAnimationFrame(() => handleScroll())
})
</script>

<style scoped>
/* ========= Theme & layout constants ========= */
:root{
  --lb-bg: linear-gradient(180deg, #f7f9fc 0%, #eef2f9 100%);
  --ink-900: #0b1220;
  --ink-700: #2b3240;
  --ink-500: #4a5672;
  --ink-300: #8fa3bf;

  /* 固定高度（避免壓縮/覆蓋） */
  --topbar-h: 64px;  /* 版頭總高 */
  --user-h:   56px;  /* 使用者列高度 */

  --ring: 0 8px 30px rgba(40,70,125,.15);
  --glass-stroke: rgba(22, 42, 74, .08);

  --gold: #f6d25a;
  --silver: #c9d2dd;
  --bronze: #d2a06b;
}

/* ========= Card Container ========= */
.leaderboard-card{
  width: min(860px, 96vw);
  margin: 24px auto;
  background: var(--lb-bg);
  border-radius: 18px;
  padding: 0 16px 12px;
  box-shadow: var(--ring);
  border: 1px solid var(--glass-stroke);
  position: relative;
  overflow: hidden;
}

/* ========= Top bar（固定高度，內容不擠壓） ========= */
.lb-topbar{
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--topbar-h);
  display:flex; flex-direction:column; justify-content:center;
  gap: 4px;
  background: linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.7));
  backdrop-filter: blur(6px);
  padding: 8px 6px;
  border-bottom: 1px solid var(--glass-stroke);
}
.lb-title{
  font-weight: 900;
  color: var(--ink-900);
  font-size: 18px;
  display:flex; align-items:center; gap:10px;
}
.lb-title .dot{
  width:10px;height:10px;border-radius:50%;
  background: radial-gradient(circle at 40% 40%, #72ffde, #12d3ff);
  box-shadow: 0 0 18px rgba(21,203,255,.6);
}
.lb-subtitle{
  color: var(--ink-300);
  font-weight: 700;
  font-size: 12px;
  line-height: 1;
}

/* ========= 共用三欄 grid ========= */
.grid-3{
  display:grid;
  grid-template-columns: 90px 1fr 160px;
  align-items:center;
}

/* ========= 使用者列（黏在 topbar 下方） ========= */
.User{
  position: sticky;
  top: var(--topbar-h);
  z-index: 15;
  min-height: var(--user-h);
  background: linear-gradient(90deg, rgba(55, 193, 235, 0.12), rgba(255,255,255,.95));
  color: #0f1c33;
  border-left: 4px solid #12b6e8;
  padding: 10px 14px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(39,138,255,.18);
  margin: 10px 0 10px;
}
.User .rank-col, .User .name-col, .User .score-col {
  text-shadow: 0 1px 2px rgba(0,0,0,.1);
}

/* ========= 標題列（再往下黏） ========= */
.headerRow{
  position: sticky;
  top: calc(var(--topbar-h) + var(--user-h) + 8px);
  z-index: 12;
  background: rgba(255,255,255,.9);
  backdrop-filter: blur(6px);
  padding: 8px 14px;
  border-radius: 8px;
  border-bottom: 1px solid var(--glass-stroke);
  color: var(--ink-500);
  font-weight: 800;
  text-transform: uppercase;
}

/* ========= 滾動區 ========= */
.rankDisplay{
  max-height: min(62vh, 560px);
  overflow: auto;
  padding-top: 12px;
  scroll-margin-top: calc(var(--topbar-h) + var(--user-h));
}

/* ========= 每列（玩家） ========= */
.player{
  padding: 10px 14px;
  margin: 6px 0;
  background: rgba(255,255,255,.9);
  border-radius: 10px;
  border: 1px solid rgba(22,42,74,.05);
  transition: all .2s ease;
}
.player:hover{ transform: translateY(-2px); box-shadow: 0 6px 16px rgba(53,96,168,.12); }

/* 欄位樣式 */
.rank-col{
  font-weight: 900;
  color: var(--ink-700);
  text-align: center;
  font-size: 15px;
}
.name-col{
  font-weight: 700;
  color: var(--ink-700);
  min-width:0;
}
.name-text{
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.score-col{ text-align: right; }
.score-num{
  font-weight: 900; color: var(--ink-900);
}
.score-bar{
  width:100%; height:6px; border-radius:999px;
  background:#e6eefc; margin-top:6px; overflow:hidden;
}
.score-bar__fill{ height:100%; background: linear-gradient(90deg, #a134f5, #35e0ff); }

/* 前三名底色 */
.player.is-gold { background: linear-gradient(180deg, #fff8db, #fff); }
.player.is-silver { background: linear-gradient(180deg, #f2f5fa, #fff); }
.player.is-bronze { background: linear-gradient(180deg, #fff2e0, #fff); }

/* 冠軍皇冠（不擠壓文字） */
.name-wrapper{ position: relative; display:inline-flex; align-items:center; gap:8px; min-width:0; }
.crown{
  position: absolute; top: -10px; left: -18px; font-size: 16px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.2));
}
.crown.silver{ color: var(--silver); }
.crown.bronze{ color: var(--bronze); }
.crown:not(.silver):not(.bronze){ color: var(--gold); }

/* 清單中使用者高亮 */
.userRow{
  border-left: 4px solid #12b6e8;
  background: linear-gradient(90deg, rgba(46,205,255,.1), rgba(255,255,255,.95));
}

/* ========= 375px（手機） ========= */
@media (max-width: 420px){
  .leaderboard-card{ width:100%; margin:0; border-radius:0; padding: 0 10px 10px; }

  /* 手機欄寬：60 / 自適應 / 88 */
  .grid-3{ grid-template-columns: 60px 1fr 88px; }

  /* 手機高度再緊一些 */
  :root{
    --topbar-h: 60px;
    --user-h:   50px;
  }

  .lb-title{ font-size: 16px; }
  .lb-subtitle{ font-size: 11px; }

  .User{ padding: 8px 10px; margin: 8px 0 8px; border-radius: 10px; }
  .headerRow{ padding: 6px 10px; border-radius: 8px; font-size: 11px; }

  .player{ padding: 9px 10px; margin: 5px 0; border-radius: 8px; }
  .rank-col{ font-size: 14px; }
  .name-col{ font-size: 14px; }
  .score-col{ font-size: 13px; }
  .score-num{ font-size: 14px; }
  .score-bar{ width: 72px; height: 5px; margin-left: auto; }

  .crown{ left: -14px; top: -9px; font-size: 14px; }
}

/* 更小裝置（<=370） */
@media (max-width: 370px){
  .grid-3{ grid-template-columns: 54px 1fr 78px; }
  :root{ --user-h: 48px; }
  .score-bar{ width: 60px; }
}

/* 空狀態 */
.empty{
  padding: 40px 12px 60px;
  text-align:center;
  color: var(--ink-300);
  font-weight: 700;
}
</style>
