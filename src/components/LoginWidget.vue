<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

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
  } catch (err: any) {
    message.value = `❌ 登入失敗：${err.message}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <h2>登入系統</h2>
    <form @submit.prevent="handleLogin">
      <label>
        使用者名稱：
        <input v-model="username" type="text" required autocomplete="username" />
      </label>

      <label>
        密碼：
        <input v-model="password" type="password" required autocomplete="current-password" />
      </label>

      <button type="submit" :disabled="loading">
        {{ loading ? '登入中…' : '登入' }}
      </button>
    </form>

    <p class="msg">{{ message }}</p>
  </div>
</template>

<style scoped>
.login-container {
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
}
</style>
