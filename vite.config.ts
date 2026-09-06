import { defineConfig } from 'vite'

// COOP/COEP 없음 — ASYNCIFY 빌드는 SharedArrayBuffer 불필요, 헤더가 있으면 V8 광고 SDK iframe이 깨짐(freedoom-web 선례)
export default defineConfig({
  base: './',            // Verse8 하위경로 호스팅
  publicDir: 'public',
  server: { port: 3046 },
  preview: { port: 3046 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 5000 },
  assetsInclude: ['**/*.wasm'],
  test: { include: ['tests/**/*.test.ts'] },
} as never)
