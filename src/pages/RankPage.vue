<template>
  <div class="leaderboard-card">
    <!-- 頂部標題 -->
    <div class="lb-topbar">
      <div class="lb-title">
        <span class="dot"></span>
        Taipei Sports — Leaderboard
      </div>
      <div class="lb-subtitle">Top players this week</div>
    </div>

    <!-- 使用者列 -->
    <div class="User" :class="{ highlight: isUserHighlighted }" ref="userRow">
      <div class="rank-col">{{ user.rank }}</div>
      <div class="name-col">{{ user.name }}</div>
      <div class="score-col">{{ user.score }}</div>
    </div>

    <!-- 標題列 -->
    <div class="headerRow">
      <div class="rank-col">Rank</div>
      <div class="name-col">Name</div>
      <div class="score-col">Score</div>
    </div>

    <!-- 排行榜內容 -->
    <div class="rankDisplay" ref="rankDisplay" @scroll="handleScroll">
      <div
        v-for="p in displayedPlayers"
        :key="p.name"
        class="player"
        :class="[ p.name === user.name ? 'userRow' : '', medalClass(p.rank) ]"
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

<script setup>
import { ref, onMounted, shallowRef, computed } from "vue"

const allPlayers = shallowRef(
  Array.from({ length: 47 }, (_, i) => ({
    rank: i + 1,
    name: `Player${i + 1}`,
    score: 10000 - i * 50,
  }))
)

const user = ref({
  name: "Player23",
  rank: 23,
  score: 10000 - 22 * 50,
})

const displayedPlayers = computed(() => {
  const data = allPlayers.value
  return data.length > 100 ? data.slice(0, 100) : data
})

const isUserHighlighted = ref(false)
const rankDisplay = ref(null)
const userRow = ref(null)

const handleScroll = () => {
  if (!userRow.value || !rankDisplay.value) return
  const userTop = userRow.value.getBoundingClientRect().top
  const listRect = rankDisplay.value.getBoundingClientRect()
  isUserHighlighted.value = userTop >= listRect.top && userTop <= listRect.bottom
}

onMounted(() => handleScroll())

/* ===== UI helpers ===== */
const maxScore = computed(() =>
  Math.max(...displayedPlayers.value.map(p => p.score || 0), 1)
)
const scorePct = (s) => Math.round((s / maxScore.value) * 100)

const medalClass = (rank) =>
  rank === 1 ? "is-gold" : rank === 2 ? "is-silver" : rank === 3 ? "is-bronze" : ""
</script>

<style scoped>
:root{
  --lb-bg: linear-gradient(180deg, #f7f9fc 0%, #eef2f9 100%);
  --me-grad: linear-gradient(90deg, #27c4f3, #6a9cff);
  --ink-900: #0b1220;
  --ink-700: #2b3240;
  --ink-500: #4a5672;
  --ink-300: #8fa3bf;
  --gold: #f6d25a;
  --silver: #c9d2dd;
  --bronze: #d2a06b;
}

/* ===== 容器 ===== */
.leaderboard-card{
  width: min(860px, 96vw);
  margin: 24px auto;
  background: var(--lb-bg);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 8px 30px rgba(40,70,125,.15);
  border: 1px solid rgba(22, 42, 74, .08);
}

/* ===== 標題 ===== */
.lb-topbar{
  display:flex; align-items:flex-end; justify-content:space-between;
  padding: 6px 6px 12px 6px;
}
.lb-title{
  font-weight: 900;
  color: var(--ink-900);
  font-size: 20px;
  display:flex; align-items:center; gap:10px;
}
.lb-title .dot{
  width:10px;height:10px;border-radius:50%;
  background: radial-gradient(circle at 40% 40%, #72ffde, #12d3ff);
  box-shadow: 0 0 18px rgba(21,203,255,.6);
}
.lb-subtitle{ color: var(--ink-300); font-weight:600; font-size:12px; }

/* ===== 使用者列 ===== */
.User{
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--me-grad);
  color: #2e6975;
  border-left: 4px solid #5ab4c5;
  background: linear-gradient(90deg, rgba(118, 205, 255, 0.1), rgba(255,255,255,.9));
  /* background: rgba(255,255,255,.85); */
  display: grid;
  grid-template-columns: 90px 1fr 160px;
  align-items:center;
  font-weight: bold;
  padding: 12px 14px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(39,138,255,.18);
  margin-bottom: 10px;
}
.User .rank-col, .User .name-col, .User .score-col {
  text-shadow: 0 1px 2px rgba(0,0,0,.28);
}

/* ===== 標題列 ===== */
.headerRow{
  position: sticky;
  top: 58px;
  z-index: 5;
  display: grid;
  grid-template-columns: 90px 1fr 160px;
  background: rgba(255,255,255,.85);
  backdrop-filter: blur(6px);
  padding: 8px 14px;
  border-radius: 8px;
  border-bottom: 1px solid rgba(22,42,74,.08);
  color: var(--ink-500);
  font-weight: 800;
  text-transform: uppercase;
}

/* ===== 滾動區 ===== */
.rankDisplay{
  max-height: min(62vh, 560px);
  overflow: auto;
  padding-top: 12px;
}

/* ===== 每列 ===== */
.player{
  display: grid;
  grid-template-columns: 90px 1fr 160px;
  align-items: center;
  padding: 10px 14px;
  margin: 6px 0;
  background: rgba(251, 251, 251, 0.8);
  border-radius: 10px;
  border: 1px solid rgba(22,42,74,.05);
  transition: all .2s ease;
}
.player:hover{ transform: translateY(-2px); box-shadow: 0 6px 16px rgba(53,96,168,.12); }

/* ===== Rank / Name / Score 欄 ===== */
.rank-col{
  font-weight: 900;
  color: var(--ink-700);
  text-align: center;
  font-size: 15px;
}
.name-col{ font-weight: 700; color: var(--ink-700); }
.score-col{ text-align: right; }

.score-num{ font-weight: 900; color: var(--ink-900); }
.score-bar{ width:100%; height:6px; border-radius:999px; background:#e6eefc; margin-top:6px; overflow:hidden; }
.score-bar__fill{ height:100%; background: linear-gradient(90deg, #55bbcd, #8a81db); }

/* ===== 前三名特效 ===== */
.player.is-gold { background: linear-gradient(180deg, #fff8db, #fff); }
.player.is-silver { background: linear-gradient(180deg, #f2f5fa, #fff); }
.player.is-bronze { background: linear-gradient(180deg, #fff2e0, #fff); }

/* ===== 皇冠 ===== */
.name-wrapper{ position: relative; display:inline-flex; align-items:center; gap:8px; }
.crown{
  position: absolute;
  top: -12px;
  left: -22px;
  font-size: 18px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.2));
}
.crown.silver{ color: var(--silver); }
.crown.bronze{ color: var(--bronze); }
.crown:not(.silver):not(.bronze){ color: var(--gold); }

/* ===== 清單中使用者高亮 ===== */
.userRow{
  border-left: 4px solid #5ab4c5;
  background: linear-gradient(90deg, rgba(118, 205, 255, 0.1), rgba(255,255,255,.9));
}
</style>
