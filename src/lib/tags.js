import { FEATURE_NAMES, FEATURE_LABELS_JA } from './features.js'
import { mean } from './stats.js'

/**
 * 「このタグが付いた日、顔はどう違ったか」を出す。
 * 因果ではなく、記録の中で一緒に起きていたことの要約。
 */
export function tagStats(entries, minCount = 3) {
  const counts = new Map()
  for (const e of entries) {
    for (const t of e.labels?.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  }

  const out = []
  for (const [tag, count] of counts) {
    if (count < minCount) continue
    const withTag = entries.filter((e) => (e.labels?.tags ?? []).includes(tag))
    const without = entries.filter((e) => !(e.labels?.tags ?? []).includes(tag))
    if (!without.length) continue

    const features = FEATURE_NAMES.map((feature) => ({
      feature,
      label: FEATURE_LABELS_JA[feature],
      delta: mean(withTag.map((e) => e.z?.[feature] ?? 0)) - mean(without.map((e) => e.z?.[feature] ?? 0)),
    }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)

    out.push({ tag, count, features })
  }
  return out.sort((a, b) => b.count - a.count)
}
