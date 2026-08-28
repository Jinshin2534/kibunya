import { computeThumbnailSize } from '../lib/thumbnail.js'

/**
 * video の現在のフレームを canvas に描いて画素を取り出す。
 *
 * maxSide を渡すと、その長辺に収まるよう縮小してから読み戻す。
 * 毎フレームの品質判定は輝度と「顔の大きさ / 画像幅」の比しか見ておらず、
 * どちらも縮尺に依存しないので、ループでは小さく読んで発熱と負荷を避ける。
 * 特徴量とサムネイルを作るシャッターの瞬間だけ、原寸で読む。
 */
export function grabFrame(videoEl, canvasEl, maxSide = 0) {
  const vw = videoEl.videoWidth
  const vh = videoEl.videoHeight
  const limited = Number.isFinite(maxSide) && maxSide > 0
  const { width, height } = limited
    ? computeThumbnailSize(vw, vh, maxSide)
    : { width: vw, height: vh }
  canvasEl.width = width
  canvasEl.height = height
  const ctx = canvasEl.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(videoEl, 0, 0, width, height)
  return { image: ctx.getImageData(0, 0, width, height), width, height }
}

export function makeThumbnail(canvasEl, maxSide = 240, quality = 0.7) {
  const { width, height } = computeThumbnailSize(canvasEl.width, canvasEl.height, maxSide)
  const t = document.createElement('canvas')
  t.width = width
  t.height = height
  t.getContext('2d').drawImage(canvasEl, 0, 0, t.width, t.height)
  return new Promise((resolve) => t.toBlob(resolve, 'image/jpeg', quality))
}
