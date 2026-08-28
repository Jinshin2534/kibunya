import { IDX, MIRROR_PAIRS } from './landmarks.js'
import { dist } from './faceFrame.js'
import { luminance, redRatio, blueRatio } from './sampling.js'

export const FEATURE_NAMES = [
  'eyeOpenL', 'eyeOpenR', 'eyeOpenAsym', 'lidHeavy',
  'underEyeDark', 'underEyeBlue',
  'faceWidthLower', 'cheekFullness', 'jawSharp',
  'mouthCornerLift', 'browHeight', 'browFurrow',
  'asymmetry', 'skinTone', 'skinRed',
]

export const FEATURE_LABELS_JA = {
  eyeOpenL: '左目の開き',
  eyeOpenR: '右目の開き',
  eyeOpenAsym: '目の開きの左右差',
  lidHeavy: 'まぶたの重さ',
  underEyeDark: '目の下の暗さ（クマ）',
  underEyeBlue: '目の下の青み',
  faceWidthLower: '顔の下半分の幅（むくみ）',
  cheekFullness: '頬の張り',
  jawSharp: '顎ラインの鋭さ',
  mouthCornerLift: '口角の上がり',
  browHeight: '眉の高さ',
  browFurrow: '眉間の狭さ',
  asymmetry: '顔の左右差',
  skinTone: '肌の明るさ',
  skinRed: '肌の赤み',
}

// 2つの色の平均（片方が null なら他方、両方 null なら null）
function meanColor(a, b) {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  return { r: (a.r + b.r) / 2, g: (a.g + b.g) / 2, b: (a.b + b.b) / 2 }
}

function eyeAspect(p, upper, lower, inner, outer) {
  const w = dist(p[inner], p[outer])
  if (w < 1e-9) return 0
  return dist(p[upper], p[lower]) / w
}

// 3点 a-b-c の b における角度（度）
function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const n1 = Math.hypot(v1.x, v1.y), n2 = Math.hypot(v2.x, v2.y)
  if (n1 < 1e-9 || n2 < 1e-9) return 0
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (n1 * n2)))
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * 顔座標系の点と色サンプルから特徴量 15 本を作る。
 * 幾何の値はすべて「内眼角間距離 = 1」の単位なので、撮影距離と傾きに依存しない。
 * 色の値はすべて顔全体の平均で割った相対値なので、明るさの違いをある程度吸収する。
 */
export function extractFeatures(points, colors) {
  const p = points
  const c = colors || {}

  const eyeOpenL = eyeAspect(p, IDX.eyeUpperL, IDX.eyeLowerL, IDX.eyeInnerL, IDX.eyeOuterL)
  const eyeOpenR = eyeAspect(p, IDX.eyeUpperR, IDX.eyeLowerR, IDX.eyeInnerR, IDX.eyeOuterR)

  const lidHeavy = (dist(p[IDX.browTopL], p[IDX.eyeUpperL])
                  + dist(p[IDX.browTopR], p[IDX.eyeUpperR])) / 2

  const underEye = meanColor(c.underEyeL, c.underEyeR)
  const cheek = meanColor(c.cheekL, c.cheekR)
  const faceMean = c.faceMean || null
  const faceLum = faceMean ? luminance(faceMean) : 0

  const underEyeDark = (underEye && cheek && faceLum > 1e-6)
    ? (luminance(cheek) - luminance(underEye)) / faceLum : 0
  const underEyeBlue = (underEye && cheek)
    ? blueRatio(underEye) - blueRatio(cheek) : 0
  const skinTone = (cheek && faceLum > 1e-6) ? luminance(cheek) / faceLum : 0
  const skinRed = cheek ? redRatio(cheek) : 0

  const faceWidthLower = dist(p[IDX.jawL], p[IDX.jawR])
  const cheekFullness = (Math.abs(p[IDX.cheekL].x) + Math.abs(p[IDX.cheekR].x)) / 2
  // 顎での角度は、尖った顎ほど小さくなる。名前とラベル（鋭さ）に合わせて向きを反転する。
  const jawSharp = 180 - angleAt(p[IDX.jawL], p[IDX.chin], p[IDX.jawR])

  const mouthCenterY = (p[IDX.mouthUpper].y + p[IDX.mouthLower].y) / 2
  const mouthCornerY = (p[IDX.mouthL].y + p[IDX.mouthR].y) / 2
  const mouthCornerLift = mouthCenterY - mouthCornerY

  const browHeight = -(p[IDX.browTopL].y + p[IDX.browTopR].y) / 2
  const browFurrow = -dist(p[IDX.browInnerL], p[IDX.browInnerR])

  let asym = 0
  for (const [l, r] of MIRROR_PAIRS) {
    asym += Math.abs(p[l].x + p[r].x) + Math.abs(p[l].y - p[r].y)
  }
  const asymmetry = asym / MIRROR_PAIRS.length

  return {
    eyeOpenL, eyeOpenR,
    eyeOpenAsym: eyeOpenL - eyeOpenR,
    lidHeavy,
    underEyeDark, underEyeBlue,
    faceWidthLower, cheekFullness, jawSharp,
    mouthCornerLift, browHeight, browFurrow,
    asymmetry, skinTone, skinRed,
  }
}

export function toVector(obj) {
  const o = obj || {}
  return FEATURE_NAMES.map((n) => (Number.isFinite(o[n]) ? o[n] : 0))
}
