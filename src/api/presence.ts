// src/api/presence.ts
import { useAuth } from '@/composables/useAuth'

const API_BASE = import.meta.env.VITE_API_BASE as string

export interface PresencePayload {
  user_id: string
  lng: number
  lat: number
  timestamp: string
}

/**
 * 將當前使用者位置傳送給後端
 * @param payload - 包含 user_id, lng, lat, timestamp
 */
export async function sendPresence(payload: PresencePayload): Promise<void> {
  const { authHeader } = useAuth()
  const headers = {
    'Content-Type': 'application/json',
    ...authHeader(), // 自動附上 Bearer token
  }

  try {
    await fetch(`${API_BASE}/api/pressence`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    // 不處理回傳（成功即可）
  } catch (err) {
    console.error('❌ 傳送 presence 失敗：', err)
  }
}
