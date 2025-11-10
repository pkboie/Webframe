// src/services/dataset.ts
import http from '@/libs/http'
const API_BASE   = import.meta.env.VITE_API_BASE as string
export interface DatasetResponse {
  data: unknown
}

export async function getDataset() {
  const res = await http.get<DatasetResponse>(`${API_BASE}/api/dataset`)
  return res.data
}
