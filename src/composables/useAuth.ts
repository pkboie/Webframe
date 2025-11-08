// src/composables/useAuth.ts
const API_BASE = import.meta.env.VITE_API_BASE as string
const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'app_token'

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export function useAuth() {
  /** 暫存 token */
  function setToken(token: string) {
    sessionStorage.setItem(TOKEN_KEY, token)
  }

  function getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY)
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY)
  }

  /** 自動帶上 Authorization header */
  function authHeader() {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  /** 登入 */
  async function login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!res.ok) {
      const msg = await res.text()
      throw new Error(`Login failed (${res.status}): ${msg}`)
    }

    const data = (await res.json()) as LoginResponse
    if (!data.access_token) throw new Error('No access_token in response')

    setToken(data.access_token)
    return data
  }

  /** 登出 */
  function logout() {
    clearToken()
  }

  return { login, logout, getToken, authHeader }
}
