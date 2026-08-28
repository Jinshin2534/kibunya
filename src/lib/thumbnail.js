/**
 * 長辺が maxSide に収まるよう、縦横比を保ったまま縮小したサイズを返す。
 * 元が小さいときは拡大しない（1 より大きい倍率は使わない）。
 */
export function computeThumbnailSize(width, height, maxSide) {
  const w = Number.isFinite(width) && width > 0 ? width : 0
  const h = Number.isFinite(height) && height > 0 ? height : 0
  const m = Number.isFinite(maxSide) && maxSide > 0 ? maxSide : 0
  if (!w || !h || !m) return { width: 0, height: 0, scale: 0 }
  const scale = Math.min(1, m / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale }
}
