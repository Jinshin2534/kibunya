import { IDX } from './landmarks.js'

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * 顔そのものを基準にした座標系に移す。
 *   原点 = 両目の内眼角の中点
 *   単位 = 内眼角間距離（= 1.0）
 *   回転 = 目線が水平になるよう補正（roll 除去）
 *   x+ = 被写体の左（画像の右） / y+ = 下
 * これにより「カメラとの距離」「顔の傾き」「画面内の位置」の差が消える。
 */
export function toFaceFrame(landmarks, imageWidth, imageHeight) {
  const px = landmarks.map((p) => ({ x: p.x * imageWidth, y: p.y * imageHeight }))
  const L = px[IDX.eyeInnerL]
  const R = px[IDX.eyeInnerR]
  const origin = mid(L, R)
  const scalePx = dist(L, R)
  const s = scalePx > 1e-9 ? scalePx : 1

  // 画像上で R→L を向くベクトルの角度。これを 0 に戻す。
  const theta = Math.atan2(L.y - R.y, L.x - R.x)
  const cos = Math.cos(-theta)
  const sin = Math.sin(-theta)

  const points = px.map((p) => {
    const dx = (p.x - origin.x) / s
    const dy = (p.y - origin.y) / s
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
  })

  return {
    points,
    scalePx,
    rollDeg: (theta * 180) / Math.PI,
    originPx: origin,
  }
}

/**
 * 顔の「前向き」軸がカメラ軸からどれだけ外れているか（度）。
 * 変換行列の 3列目 = 顔の前方向。その z 成分だけで角度が決まるので、
 * Euler 角の分解規約に依存しない。yaw と pitch をまとめて1つの数字で扱う。
 */
export function offAxisDeg(matrix) {
  // 行列が無い・壊れているときは「向きを測れていない」であって「正面だった」ではない。
  // 0 を返すと quality.js の Number.isFinite ガードを素通りして未測定のまま
  // ゲートに合格してしまうので、数値ではなく null を返して不合格側に倒す。
  if (!matrix || matrix.length < 16) return null
  const fz = matrix[10] // 列優先 4x4 の (row2, col2)
  const c = Math.min(1, Math.max(-1, Math.abs(fz)))
  return (Math.acos(c) * 180) / Math.PI
}
