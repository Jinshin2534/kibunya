import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5420, strictPort: true },
  preview: { port: 5420, strictPort: true },
  // src/app.js は初回描画の前に IndexedDB からの読み込み（await load()）を
  // トップレベル await で待つ。このアプリは MediaPipe の WASM/GPU 推論のために
  // どのみち最新ブラウザを前提としているので、target を esnext に上げて
  // トップレベル await をそのままビルドに通す。
  build: { target: 'esnext' },
})
