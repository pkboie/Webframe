// vitest.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, mergeConfig, configDefaults, UserConfig } from 'vitest/config'
import viteConfig from './vite.config'

// 把可能是 function/async function 的 vite 設定解析成「物件」
// 若你的 vite.config 是 defineConfig({...}) 的純物件，也能直接用
async function resolveViteConfig(): Promise<UserConfig> {
  // vite 的 config function 簽名是 ({ command, mode })
  const env = { command: 'serve' as const, mode: process.env.NODE_ENV ?? 'test' }

  // 若是函式就呼叫，否則直接用；也支援 async function
  const raw = typeof viteConfig === 'function' ? viteConfig(env) : viteConfig
  const resolved = await Promise.resolve(raw)

  // 有些人會再包一層 defineConfig(...)，這裡強轉成 UserConfig ok
  return resolved as UserConfig
}

export default defineConfig(async () => {
  const base = await resolveViteConfig()

  // 這裡放 Vitest 的測試設定；與 Vite 設定合併
  const testConfig: UserConfig = {
    test: {
      environment: 'jsdom',
      globals: true,
      css: true,
      exclude: [...configDefaults.exclude, 'e2e/**'],
      setupFiles: fileURLToPath(new URL('./vitest.setup.ts', import.meta.url)), // 可選
      // coverage: { reporter: ['text', 'html'] }, // 需要覆蓋率再開
    },
    resolve: {
      // 確保別的工具直接跑 vitest 時也有 alias
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }

  return mergeConfig(base, testConfig)
})
