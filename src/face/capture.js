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
  const scale = Math.min(1, maxSide / Math.max(canvasEl.width, canvasEl.height))
  const t = document.createElement('canvas')
  t.width = Math.round(canvasEl.width * scale)
  t.height = Math.round(canvasEl.height * scale)
  t.getContext('2d').drawImage(canvasEl, 0, 0, t.width, t.height)
  return new Promise((resolve) => t.toBlob(resolve, 'image/jpeg', quality))
}
