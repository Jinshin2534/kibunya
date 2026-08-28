import { computeThumbnailSize } from '../lib/thumbnail.js'

export function grabFrame(videoEl, canvasEl) {
  const width = videoEl.videoWidth
  const height = videoEl.videoHeight
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
