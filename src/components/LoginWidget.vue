<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const showLogin = ref(true)
const username = ref('')
const password = ref('')
const loading  = ref(false)
const showbox = ref(true)

// 彈窗
const showPopup = ref(false)
const popupText = ref('')

const { login } = useAuth()

async function signup(u: string, p: string) {
  const r = await fetch('http://localhost:8000/auth/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({ username: u, password: p }),
  })
  let data: any = {}
  try { data = await r.json() } catch { /* ignore */ }
  return { ok: r.ok, data }
}

/** 單一按鈕流程：先嘗試註冊；若已存在→自動登入；若新建→只提示「帳號已註冊」 */
async function handleSubmit() {
  loading.value = true
  try {
    const s = await signup(username.value, password.value)

    // 狀況 A：帳號剛建立（未註冊 → 註冊成功）
    if (s.ok && s.data?.message === 'Created successfully') {
      popupText.value = '註冊成功！請重新登入！'
      showPopup.value = true
      // 不自動登入，結束流程
      return
    }

    // 狀況 B：帳號已存在 → 直接登入
    if (s.data?.detail === 'Username already exists') {
      const res = await login(username.value, password.value)
      popupText.value = '已登入'
      showPopup.value = true
      // 你想在彈窗關閉後再關遮罩，也可以在 closePopup() 裡做
      showbox.value = false
      return
    }

    // 其他錯誤（無法歸類）
    throw new Error(s.data?.detail || s.data?.message || '發生未知錯誤')
  } catch (err: any) {
    popupText.value = `失敗：${err?.message ?? '請稍後重試'}`
    showPopup.value = true
  } finally {
    loading.value = false
  }
}

function closePopup() {
  if (popupText.value === '已登入') {
    showLogin.value = false
  }
  showPopup.value = false
}
</script>

<template>
  <div class="overlay" v-if="showLogin">
    <div class="login-box" v-if="showbox">
      <h2>註冊 / 登入</h2>

      <form @submit.prevent="handleSubmit">
        <label>
          <input
            v-model="username"
            type="text"
            required
            autocomplete="username"
            placeholder="使用者名稱"
            class="input-field"
          />
        </label>

        <label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="密碼"
            class="input-field"
          />
        </label>

        <button type="submit" :disabled="loading" class="confirm-btn">
          {{ loading ? '處理中…' : '註冊 / 登入' }}
        </button>
      </form>
    </div>

    <!-- 彈窗 -->
    <div class="toast" v-if="showPopup">
      <div class="toast-card">
        <p>{{ popupText }}</p>
        <button class="toast-btn" @click="closePopup">關閉</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 背景遮罩 */
.overlay {
  position: fixed; inset: 0;
  background: rgba(220, 220, 220, 0.7);
  display: flex; justify-content: center; align-items: center;
  z-index: 9999; backdrop-filter: blur(4px);
}

/* 登入盒 */
.login-box {
  background: #fff; border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  padding: 2rem; width: 320px; text-align: center;
}

h2 { margin-bottom: 1rem; font-size: 1.5rem; }

.input-field {
  display: block; width: 100%;
  padding: 0.6rem; margin: 0.5rem 0;
  border: 1px solid #ccc; border-radius: 8px; outline: none;
}
.input-field:focus { border-color: #007bff; }

.confirm-btn {
  width: 100%; padding: 0.6rem;
  background: #007bff; color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
  margin-top: 0.8rem; transition: background 0.3s;
}
.confirm-btn:hover { background: #0056b3; }

/* 彈窗（置底小卡） */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 10000;
}
.toast-card {
  background: #fff; border: 1px solid #e5e7eb;
  padding: .9rem 1rem; border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.15);
  min-width: 260px; text-align: center;
}
.toast-btn {
  margin-top: .6rem; background: #111827; color: #fff;
  border: none; border-radius: 8px; padding: .45rem .7rem; cursor: pointer;
}
.toast-btn:hover { opacity: .9; }
</style>
