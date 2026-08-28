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
  for (const n of FEATURE_NAMES) {
    if (!baseline) { out[n] = 0; continue }
    const s = sdFloor(num(baseline.sd[n]), num(baseline.mean[n]))
    const z = (num(features?.[n]) - num(baseline.mean[n])) / s
    out[n] = Math.max(-Z_CLAMP, Math.min(Z_CLAMP, z))
  }
  return out
}

export function updateBaseline(baseline, features) {
  const prev = baseline?.values ?? []
  return buildBaseline([...prev, features])
}
