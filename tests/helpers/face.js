import { IDX } from '../../src/lib/landmarks.js'

/** 決定的な擬似乱数（テストが毎回同じ結果になるように） */
export function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

/**
 * 478 点のダミー顔（正規化画像座標）。
 * 特徴量の計算に使う点だけ明示的に置き、残りは決定的な乱数で埋める。
 * overrides で任意の点を差し替えられる。
 */
export function makeFace(overrides = {}) {
  const rnd = rng(7)
  const pts = []
  for (let i = 0; i < 478; i++) pts.push({ x: 0.35 + rnd() * 0.3, y: 0.25 + rnd() * 0.45, z: 0 })
  Object.assign(pts, {
    [IDX.eyeInnerR]: { x: 0.45, y: 0.40, z: 0 },
    [IDX.eyeInnerL]: { x: 0.55, y: 0.40, z: 0 },
    [IDX.eyeOuterR]: { x: 0.40, y: 0.40, z: 0 },
    [IDX.eyeOuterL]: { x: 0.60, y: 0.40, z: 0 },
    [IDX.eyeUpperR]: { x: 0.43, y: 0.38, z: 0 },
    [IDX.eyeLowerR]: { x: 0.43, y: 0.42, z: 0 },
    [IDX.eyeUpperL]: { x: 0.57, y: 0.38, z: 0 },
    [IDX.eyeLowerL]: { x: 0.57, y: 0.42, z: 0 },
    [IDX.browTopR]: { x: 0.43, y: 0.34, z: 0 },
    [IDX.browTopL]: { x: 0.57, y: 0.34, z: 0 },
    [IDX.browInnerR]: { x: 0.47, y: 0.35, z: 0 },
    [IDX.browInnerL]: { x: 0.53, y: 0.35, z: 0 },
    [IDX.mouthR]: { x: 0.45, y: 0.62, z: 0 },
    [IDX.mouthL]: { x: 0.55, y: 0.62, z: 0 },
    [IDX.mouthUpper]: { x: 0.50, y: 0.60, z: 0 },
    [IDX.mouthLower]: { x: 0.50, y: 0.64, z: 0 },
    [IDX.chin]: { x: 0.50, y: 0.76, z: 0 },
    [IDX.jawR]: { x: 0.41, y: 0.68, z: 0 },
    [IDX.jawL]: { x: 0.59, y: 0.68, z: 0 },
    [IDX.faceEdgeR]: { x: 0.37, y: 0.50, z: 0 },
    [IDX.faceEdgeL]: { x: 0.63, y: 0.50, z: 0 },
    [IDX.cheekR]: { x: 0.42, y: 0.55, z: 0 },
    [IDX.cheekL]: { x: 0.58, y: 0.55, z: 0 },
    [IDX.underEyeR]: { x: 0.43, y: 0.45, z: 0 },
    [IDX.underEyeL]: { x: 0.57, y: 0.45, z: 0 },
    [IDX.noseTip]: { x: 0.50, y: 0.52, z: 0 },
  }, overrides)
  return pts
}

/** 画像座標（0..1、アスペクト W:H）の上で 回転・拡大・平行移動 を掛ける */
export function transformFace(pts, { deg = 0, scale = 1, dx = 0, dy = 0 }, W, H) {
  const t = (deg * Math.PI) / 180
  const cos = Math.cos(t), sin = Math.sin(t)
  return pts.map((p) => {
    const px = p.x * W, py = p.y * H, cx = 0.5 * W, cy = 0.5 * H
    const rx = (px - cx) * cos - (py - cy) * sin
    const ry = (px - cx) * sin + (py - cy) * cos
    return { x: (cx + rx * scale) / W + dx, y: (cy + ry * scale) / H + dy, z: p.z }
  })
}
