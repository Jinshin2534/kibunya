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

/**
 * 1〜5（SCALE_MIN〜SCALE_MAX）にクランプする共有ヘルパー。
 * lib/model.js・lib/synthetic.js・lib/persona.js がそれぞれ持っていた
 * ほぼ同じクランプ処理をここに集約した。round=true（既定）は整数に丸めてから
 * クランプする（ラベル・合成データ・言い回しの選択に使う）。model.js の予測値の
 * ように連続値のままクランプしたい呼び出し元だけ round=false を渡すこと
 * （既存の呼び出し側の丸め有無はどちらも変えていない）。
 * NaN・Infinity を「まん中」などの既定値に倒す処理はここではしない。
 * それは呼び出し側の責務（下の normalizeLabels を参照）。
 */
export function clampScale(v, round = true) {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, round ? Math.round(v) : v))
}

export function normalizeLabels(raw) {
  const r = raw || {}
  const tags = Array.isArray(r.tags)
    ? [...new Set(r.tags.map((t) => String(t).trim()).filter(Boolean))]
    : []
  // 数値でない・NaN・±Infinity は「まん中」の 3 に倒す。ここは正規化固有の
  // フォールバックなので、汎用の clampScale には入れていない。
  const normalizeOne = (v) => (Number.isFinite(v) ? clampScale(v) : 3)
  return {
    condition: normalizeOne(typeof r.condition === 'number' ? r.condition : NaN),
    mood: normalizeOne(typeof r.mood === 'number' ? r.mood : NaN),
    sleepiness: normalizeOne(typeof r.sleepiness === 'number' ? r.sleepiness : NaN),
    tags,
  }
}
