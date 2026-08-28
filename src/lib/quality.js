export const THRESHOLDS = Object.freeze({
  offAxisDeg: 10,   // 正面からのズレ
  rollDeg: 10,      // 首の傾き
  scaleMin: 0.08,   // 内眼角間距離 / 画像幅
  scaleMax: 0.20,
  lumMin: 60,       // 顔領域の平均輝度（0-255）
  lumMax: 200,
  motion: 0.006,    // フレーム間の平均移動量（正規化画像座標。1.0 = 画像の幅/高さ）
})

// 未測定（undefined・NaN）は「良好」寄りの初期値で埋めない。
// 例えば motion は直前フレームとの比較でしか求まらないため、
// セッション最初の1枚には値がない。ここを合格側の既定値で埋めると
// 「測っていない」がそのまま「合格」として記録されてしまうので、
// 数値項目はすべて Number.isFinite を要求し、未測定は不合格として扱う。
/**
 * 撮っていい状態かを判定する。
 * すべて緑になったときだけシャッターを切ることで、
 * 「体調ではなく撮り方の違いを測ってしまう」事故を防ぐ。
 */
export function checkQuality(input) {
  const {
    faceFound = false, offAxisDeg, rollDeg,
    scalePx = 0, imageWidth = 1, faceLuminance = 0, motion,
  } = input || {}

  const ratio = imageWidth > 0 ? scalePx / imageWidth : 0
  const T = THRESHOLDS

  const checks = [
    {
      key: 'face', label: '顔の検出', ok: faceFound,
      hint: 'カメラに顔を入れてください',
    },
    {
      key: 'direction', label: '顔の向き',
      ok: faceFound && Number.isFinite(offAxisDeg) && Math.abs(offAxisDeg) <= T.offAxisDeg,
      hint: 'まっすぐ正面を向いてください',
    },
    {
      key: 'tilt', label: '顔の傾き',
      ok: faceFound && Number.isFinite(rollDeg) && Math.abs(rollDeg) <= T.rollDeg,
      hint: '首をまっすぐにしてください',
    },
    {
      key: 'size', label: '顔の大きさ',
      ok: faceFound && Number.isFinite(scalePx) && Number.isFinite(imageWidth)
        && ratio >= T.scaleMin && ratio <= T.scaleMax,
      hint: ratio < T.scaleMin ? 'もう少し近づいてください' : 'もう少し離れてください',
    },
    {
      key: 'light', label: '明るさ',
      ok: faceFound && Number.isFinite(faceLuminance)
        && faceLuminance >= T.lumMin && faceLuminance <= T.lumMax,
      hint: faceLuminance < T.lumMin ? 'もっと明るい場所へ' : 'まぶしすぎます。光を弱めてください',
    },
    {
      key: 'still', label: '静止',
      ok: faceFound && Number.isFinite(motion) && motion <= T.motion,
      hint: '動かずに止まってください',
    },
  ]

  return { ok: checks.every((c) => c.ok), checks }
}
