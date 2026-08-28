import { toFaceFrame, offAxisDeg } from './lib/faceFrame.js'
import { sampleFaceColors } from './lib/faceColors.js'
import { extractFeatures } from './lib/features.js'
import { checkQuality } from './lib/quality.js'
import { luminance } from './lib/sampling.js'

/**
 * landmarks 1枚分 → 顔座標系・色・特徴量・品質 をまとめて出す。
 * カメラにも DOM にも依存しないので、テストからもヘッドレスからも同じ道を通せる。
 */
export function analyze(landmarks, matrix, image, imageWidth, imageHeight, motion = null) {
  if (!landmarks) {
    return {
      frame: null, colors: null, features: null,
      quality: checkQuality({ faceFound: false }),
    }
  }
  const frame = toFaceFrame(landmarks, imageWidth, imageHeight)
  const colors = image
    ? sampleFaceColors(image, landmarks, imageWidth, imageHeight, frame.scalePx)
    : { underEyeL: null, underEyeR: null, cheekL: null, cheekR: null, faceMean: null }
  const features = extractFeatures(frame.points, colors)
  const quality = checkQuality({
    faceFound: true,
    offAxisDeg: offAxisDeg(matrix),
    rollDeg: frame.rollDeg,
    scalePx: frame.scalePx,
    imageWidth,
    // 顔色を採取できなかった（faceMean が null）場合、それらしい既定値で埋めると
    // 「測っていない」が合格として扱われてしまう。measured でないなら null をそのまま
    // 渡し、quality.js の Number.isFinite チェックで不合格にさせる。
    faceLuminance: colors.faceMean ? luminance(colors.faceMean) : null,
    motion,
  })
  return { frame, colors, features, quality }
}

/**
 * 直近2フレームの landmark 平均移動量（正規化画像座標。capturePanel が渡すのは MediaPipe の生の 0..1 座標）。
 * 比較対象となる前フレームがない（初回フレームや landmark 数が変わった直後）場合は
 * 「動いていない(0)」ではなく null を返す。0 で埋めると quality.js の still チェックが
 * 未測定のまま合格してしまうため、未計測は明示的に null として上流に伝える。
 */
export function motionBetween(prevPoints, points) {
  if (!prevPoints || !points || prevPoints.length !== points.length) return null
  let s = 0
  for (let i = 0; i < points.length; i++) {
    s += Math.hypot(points[i].x - prevPoints[i].x, points[i].y - prevPoints[i].y)
  }
  return s / points.length
}
