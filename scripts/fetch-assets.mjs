// MediaPipe の wasm とモデルを public/ に用意する。
// CDN に依存せず、同一オリジンから読む（外部への通信を実行時に起こさないため）。
import { cp, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const wasmDest = resolve(root, 'public/mediapipe/wasm')
const modelDest = resolve(root, 'public/mediapipe/face_landmarker.task')
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const exists = (p) => stat(p).then(() => true, () => false)

await mkdir(dirname(modelDest), { recursive: true })
await cp(wasmSrc, wasmDest, { recursive: true })
console.log('wasm をコピーしました:', wasmDest)

if (await exists(modelDest)) {
  console.log('モデルは取得済みです')
} else {
  console.log('モデルを取得します...')
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`モデルの取得に失敗しました: ${res.status}`)
  await writeFile(modelDest, Buffer.from(await res.arrayBuffer()))
  console.log('モデルを保存しました:', modelDest)
}
