// src/api/pressence.ts
import { useAuth } from '@/composables/useAuth'

const API_BASE = import.meta.env.VITE_API_BASE as string

export interface pressencePayload {
  user_id: string
  lng: number
  lat: number
  timestamp: string
}

/**
 * 將當前使用者位置傳送給後端
 * @param payload - 包含 user_id, lng, lat, timestamp
 */
export async function sendpressence(payload: pressencePayload): Promise<void> {
  const { authHeader } = useAuth()
  const { Authorization } = authHeader() as { Authorization?: string }

  // ✅ 一次性安全 headers 建立：只有在 token 存在時才加入
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (Authorization) headers['Authorization'] = Authorization

  try {
    const res = await fetch(`${API_BASE}/api/pressence`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const msg = `HTTP ${res.status} ${res.statusText}`
      console.error('❌ 傳送 pressence 失敗：', msg)
    }
  } catch (err) {
    console.error('❌ 傳送 pressence 失敗：', err)
  }
}
