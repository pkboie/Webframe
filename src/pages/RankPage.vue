<template>
  <div class="User" :class="{ highlight: isUserHighlighted }">
    <div class="rank">{{ user.rank ?? '-' }}</div>
    <div class="name">{{ user.name }}</div>
    <div class="score">{{ user.score ?? '-' }}</div>
  </div>
  <div class="leaderboard">
    <!-- 使用者列（固定於排行榜最上方） -->

    <!-- 標題列 -->
    <div class="headerRow">
      <div class="rank">RANK</div>
      <div class="name">NAME</div>
      <div class="score">SCORE</div>
    </div>

    <!-- 排行榜內容 -->
    <div class="rankDisplay" ref="rankDisplay" @scroll="handleScroll">
      <div
        v-for="p in displayedPlayers"
        :key="p.name"
        class="player"
        :class="{ userRow: p.name === user.name }"
        :ref="p.name === user.name ? 'userRow' : null"
      >
        <div class="rank">{{ p.rank }}</div>
        <div class="name">{{ p.name }}</div>
        <div class="score">{{ p.score }}</div>
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
  const userRowElement = Array.isArray(userRow.value) ? userRow.value[0] : userRow.value
  if (!userRowElement) return

  const userTop = userRowElement.getBoundingClientRect().top
  const listTop = rankDisplay.value.getBoundingClientRect().top
  const listBottom = rankDisplay.value.getBoundingClientRect().bottom
  isUserHighlighted.value = userTop >= listTop && userTop <= listBottom
}

onMounted(() => {
  handleScroll()
})
</script>

<style scoped>
.leaderboard {
  width: 100%;
  /* margin: -2rem auto; */
  overflow: hidden;
  font-family: "微軟正黑體", sans-serif;
  background: linear-gradient(180deg, #fdfdfd 0%, #eef3fa 100%);
  position: relative;
  /* ✅ 移除白色邊框與外圈陰影 */
  border: none;
  box-shadow: none;
}


/* ✅ 使用者列改為絕對定位，貼齊排行榜頂端 */
/* ✅ 使用者列永遠固定於畫面最上方 */
.User {
  position:sticky;
  width: 100%;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(90deg, #9cdcff, #cbb4ff);
  /* color: #2e2e2e; */
  font-weight: bold;
  padding: 10px 14px;
  font-size: 15px;
  z-index: 9999; /* 確保在所有內容之上 */
  box-shadow: inset 0 -2px 4px rgba(255, 255, 255, 0.3),
              0 2px 6px rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}


/* 使用者高亮動畫 */
/* .User.highlight {
  animation: glow 2s infinite alternate;
}
@keyframes glow {
  from {
    box-shadow: 0 0 6px #fff7b1, 0 0 15px #ffe066;
  }
  to {
    box-shadow: 0 0 18px #fff176, 0 0 36px #ffd54f;
  }
} */

/* 標題列 */
.headerRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(90deg, #f8f8f8, #e9e9e9);
  color: #333;
  font-weight: bold;
  padding: 8px 14px;
  border-bottom: 1px solid #ccc;
  font-size: 14px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  /* margin-top: 45px; ✅ 讓標題在使用者列下方 */
}

/* 排行榜滾動區 */
.rankDisplay {
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #aaa #f0f0f0;
  padding-top: 10px; /* 預留間距 */
}

/* 玩家列 */
.player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid #eee;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.85);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* 滑過玩家列亮光動畫 */
/* .player::before {
  content: "";
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: skewX(-20deg);
} */

.player:hover::before {
  animation: shine 0.8s forwards;
}
@keyframes shine {
  100% {
    left: 125%;
  }
}

.player:hover {
  background: #f9fbff;
  transform: scale(1.015);
}

/* 使用者所在列高亮 */
.userRow {
  background: linear-gradient(90deg, #4bcde7, #5ab4c5);
  font-weight: bold;
  border-left: 4px solid #0898b5;
}
.userRow  > div{
  color: white ;
}

/* 欄位配置 */
.rank {
  width: 55px;
  text-align: center;
  font-weight: 600;
  color: #444;
}
.name {
  flex: 1;
  text-align: left;
  padding-left: 12px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.score {
  width: 70px;
  text-align: right;
  color: #222;
  font-weight: 600;
}
</style>
