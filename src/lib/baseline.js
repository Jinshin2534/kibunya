import { FEATURE_NAMES } from './features.js'
import { mean, sd } from './stats.js'

export const Z_CLAMP = 6

const num = (v) => (Number.isFinite(v) ? v : 0)

/**
 * SD の下支え。ベースラインが数枚しかないと SD がほぼ 0 になり、
 * わずかなブレが Z = 数十 に化けて回帰を壊す。平均の 5% を下限にする。
 */
export function sdFloor(sdValue, meanValue) {
  return Math.max(sdValue, 0.05 * Math.abs(meanValue), 1e-6)
}

export function buildBaseline(samples) {
  if (!samples || !samples.length) return null
  const m = {}
  const s = {}
  for (const n of FEATURE_NAMES) {
    const col = samples.map((f) => num(f?.[n]))
    m[n] = mean(col)
    s[n] = sd(col)
  }
  return { mean: m, sd: s, sampleCount: samples.length, values: samples.map((f) =>
    Object.fromEntries(FEATURE_NAMES.map((n) => [n, num(f?.[n])]))) }
}

export function toZ(features, baseline) {
  const out = {}

  // 基準が使えない場合は全て 0 を返す。
  // unknown は無限大ではなく 0 として解釈する必要がある。
  if (
    !baseline ||
    !baseline.mean || typeof baseline.mean !== 'object' ||
    !baseline.sd || typeof baseline.sd !== 'object' ||
    !Number.isFinite(baseline.sampleCount) || baseline.sampleCount < 2
  ) {
    for (const n of FEATURE_NAMES) out[n] = 0
    return out
  }

  for (const n of FEATURE_NAMES) {
    const s = sdFloor(num(baseline.sd?.[n]), num(baseline.mean?.[n]))
    const z = (num(features?.[n]) - num(baseline.mean?.[n])) / s
    out[n] = Math.max(-Z_CLAMP, Math.min(Z_CLAMP, z))
  }
  return out
}

/**
 * Z スコアの基準を、実際の日々の記録から取り直す。
 *
 * セットアップの 5 枚は「同じ一回の撮影」なので、その SD は日ごとの変動ではなく
 * その場のブレしか表していない。それで割ると、平均が 0 付近の差分系の特徴量
 * （目の開きの左右差・口角・目の下の青み）は毎日クランプに張り付き、情報が消える。
 * そこで、セットアップの 5 枚と、これまでの記録の生の特徴量をすべて混ぜて
 * 平均と SD を取り直す。記録が増えるほど基準が実態に近づく。
 */
export function pooledBaseline(baseline, entries) {
  if (!baseline) return null
  const setup = Array.isArray(baseline.values) ? baseline.values : []
  const daily = (entries ?? []).map((e) => e?.features).filter(Boolean)
  const all = [...setup, ...daily]
  return all.length ? buildBaseline(all) : baseline
}
