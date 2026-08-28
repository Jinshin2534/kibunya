export const SCALE_MIN = 1
export const SCALE_MAX = 5

export const TARGETS = [
  { key: 'condition', label: '体調', low: 'わるい', high: 'いい' },
  { key: 'mood', label: '気分', low: 'しずんでる', high: 'いい' },
  { key: 'sleepiness', label: '眠さ', low: 'ぱっちり', high: 'ねむい' },
]

export const TARGET_KEYS = TARGETS.map((t) => t.key)

export const DEFAULT_TAGS = [
  '寝不足', 'よく寝た', 'むくみ', '頭痛', '忙しい',
  '飲んだ翌日', '風邪気味', '運動した', 'ストレス', '生理',
]

export function emptyLabels() {
  return { condition: 3, mood: 3, sleepiness: 3, tags: [] }
}

function clampScale(v) {
  if (!Number.isFinite(v)) return 3
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(v)))
}

export function normalizeLabels(raw) {
  const r = raw || {}
  const tags = Array.isArray(r.tags)
    ? [...new Set(r.tags.map((t) => String(t).trim()).filter(Boolean))]
    : []
  return {
    condition: clampScale(typeof r.condition === 'number' ? r.condition : NaN),
    mood: clampScale(typeof r.mood === 'number' ? r.mood : NaN),
    sleepiness: clampScale(typeof r.sleepiness === 'number' ? r.sleepiness : NaN),
    tags,
  }
}
