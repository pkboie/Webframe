<template>
  <div class="overlay" v-if="showLogin">
    <div class="login-box">
      <h2>登入系統</h2>
      <input
        v-model="username"
        type="text"
        placeholder="使用者名稱"
        class="input-field"
      />
      <input
        v-model="password"
        type="password"
        placeholder="密碼"
        class="input-field"
      />
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <button class="confirm-btn" @click="checkLogin">確認</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const showLogin = ref(true);
const username = ref("");
const password = ref("");
const errorMsg = ref("");

// 預設正確帳號密碼，可依需求改成後端驗證
const correctUser = "admin";
const correctPass = "1234";

function checkLogin() {
  if (username.value === correctUser && password.value === correctPass) {
    showLogin.value = false;
  } else {
    errorMsg.value = "帳號或密碼錯誤，請重新輸入。";
    username.value = "";
    password.value = "";
  }
}
</script>

<style scoped>
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
