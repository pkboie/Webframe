import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') as Record<string, string>
  // 允許空值；只在是 http(s) 才啟用 proxy
  const rawBase = env.VITE_API_BASE ?? ''
  const isHttp = /^https?:\/\//i.test(rawBase)
  const API_BASE = isHttp ? rawBase.replace(/\/+$/, '') : '' // 去尾斜線

  const proxy = isHttp
    ? {
        '/api': {
          target: API_BASE,
          changeOrigin: true,
          // 如果後端實際路徑就是 /api，無需 rewrite
          // 若前端 /api 要打到後端根目錄，改用：
          // rewrite: (p: string) => p.replace(/^\/api/, ''),
        },
      }
    : undefined

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy, // 只有在 VITE_API_BASE 合法時才會設定
    },
    // 可選：把變數注入前端（若需要在程式碼中讀）
    define: {
      __API_BASE__: JSON.stringify(API_BASE),
    },
  }
})
