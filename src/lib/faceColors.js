import { IDX } from './landmarks.js'
import { sampleDisc, sampleGrid } from './sampling.js'

const DISC_RATIO = 0.18 // 内眼角間距離に対する円の半径

/**
 * 顔のどこを「目の下」「頬」「顔全体」として測るかを決めて、平均色を返す。
 * 円の大きさは顔の大きさに比例させるので、撮影距離が変わっても
 * 同じ面積（顔に対する割合）を測ることになる。
 */
export function sampleFaceColors(image, landmarks, imageWidth, imageHeight, scalePx) {
  const radius = DISC_RATIO * scalePx
  const at = (idx) => ({
    x: landmarks[idx].x * imageWidth,
    y: landmarks[idx].y * imageHeight,
  })
  const disc = (idx) => {
    const p = at(idx)
    return sampleDisc(image, p.x, p.y, radius)
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of landmarks) {
    const x = p.x * imageWidth, y = p.y * imageHeight
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  // 歩幅は顔の大きさに比例させる。scalePx が測れていないときは 1 画素刻みに倒す
  // （粗く飛ばすより、遅くても正しい平均を返すほうがよい）。
  const step = Number.isFinite(scalePx) && scalePx > 0
    ? Math.max(1, Math.round(scalePx / 8))
    : 1
  const faceMean = sampleGrid(image, {
    x: Math.max(0, Math.floor(minX)),
    y: Math.max(0, Math.floor(minY)),
    w: Math.max(0, Math.ceil(maxX - minX) + 1),
    h: Math.max(0, Math.ceil(maxY - minY) + 1),
  }, step)

  return {
    underEyeL: disc(IDX.underEyeL),
    underEyeR: disc(IDX.underEyeR),
    cheekL: disc(IDX.cheekL),
    cheekR: disc(IDX.cheekR),
    faceMean,
  }
}
