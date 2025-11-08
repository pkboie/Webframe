<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const showLogin = ref(true);
const username = ref('')
const password = ref('')
const message = ref('')
const loading = ref(false)

const { login } = useAuth()

async function handleLogin() {
  message.value = ''
  loading.value = true
  try {
    const res = await login(username.value, password.value)
    message.value = `✅ 登入成功，token 已暫存！到期時間 ${res.expires_in}s`
    showLogin.value = false;
  } catch (err: any) {
    message.value = `❌ 登入失敗`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="overlay" v-if="showLogin">
    <div class = "login-box">
      <h2>登入系統</h2>
  
      <form @submit.prevent="handleLogin">
        <label>
          <!-- 使用者名稱： -->
          <input v-model="username" type="text" required autocomplete="username" placeholder="使用者名稱" class = "input-field"/>
        </label>
  
        <label>
          <!-- 密碼： -->
          <input v-model="password" type="password" required autocomplete="current-password" placeholder="密碼" class = "input-field"/>
        </label>
  
        <button type="submit" :disabled="loading">
          {{ loading ? '登入中…' : '登入/註冊' }}
        </button>
      </form>
  
      <!-- <p class="msg">{{ message }}</p> -->

    </div>
  </div>
</template>

<style scoped>
/* .login-container {
  max-width: 360px;
  margin: 80px auto;
  padding: 20px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
}
button {
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: #2c9ae0;
  color: #fff;
  cursor: pointer;
}
button[disabled] {
  opacity: .6;
  cursor: not-allowed;
}
.msg {
  font-size: 0.9rem;
  color: #444;
} */
 .overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(220, 220, 220, 0.7); /* 淺灰透明背景 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999; /* 確保覆蓋其他畫面 */
  backdrop-filter: blur(4px);
}

.login-box {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  padding: 2rem;
  width: 300px;
  text-align: center;
}

h2 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.input-field {
  display: block;
  width: 100%;
  padding: 0.6rem;
  margin: 0.5rem 0;
  border: 1px solid #ccc;
  border-radius: 8px;
  outline: none;
}

.input-field:focus {
  border-color: #007bff;
}

.confirm-btn {
  width: 100%;
  padding: 0.6rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 0.8rem;
  transition: background 0.3s;
}

.confirm-btn:hover {
  background: #0056b3;
}

.error-msg {
  color: red;
  font-size: 0.9rem;
  margin-top: 0.3rem;
}
</style>
