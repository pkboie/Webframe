// src/services/dataset.ts
import http from '@/libs/http'

export interface DatasetResponse {
  data: unknown
}

export async function getDataset() {
  const res = await http.get<DatasetResponse>('http://localhost:8000/api/dataset')
  return res.data
}
