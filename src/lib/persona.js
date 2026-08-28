import { FEATURE_LABELS_JA } from './features.js'

export function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h | 0)
}

const pick = (arr, seed) => arr[hashString(seed) % arr.length]

const OPENERS_LOW = ['自信ないけど、', 'あてずっぽうだけど、', 'よくわからない日だな。でも、']
const OPENERS_MID = ['たぶんだけど、', '見た感じ、', 'なんとなくだけど、']
const OPENERS_HIGH = ['はっきり出てる。', '今日はわかりやすい。', '顔に書いてある。']

const CONDITION = {
  1: 'かなりしんどそう', 2: 'すこし疲れが残ってる', 3: 'ふつう',
  4: '調子はいいほう', 5: 'かなり good',
}
const SLEEPINESS = {
  1: 'ぱっちりしてる', 2: '眠くはなさそう', 3: 'ふつう',
  4: 'ちょっと眠そう', 5: 'だいぶ眠そう',
}

const round = (v) => Math.max(1, Math.min(5, Math.round(v)))

export function speak({ values, confidence, topFeature, seed = '' }) {
  const openers = confidence < 0.35 ? OPENERS_LOW : confidence < 0.7 ? OPENERS_MID : OPENERS_HIGH
  const opener = pick(openers, seed + 'o')

  const parts = []
  if (Number.isFinite(values?.condition)) parts.push(CONDITION[round(values.condition)])
  if (Number.isFinite(values?.sleepiness)) parts.push(SLEEPINESS[round(values.sleepiness)])
  const body = parts.length ? parts.join('。') + '。' : '今日はなんとも言えない。'

  const because = topFeature && FEATURE_LABELS_JA[topFeature]
    ? `${FEATURE_LABELS_JA[topFeature]}に出てる。`
    : ''

  return `${opener}${body}${because}`
}

export function growLine({ usable, n, hitRate }) {
  if (!usable) {
    return `記録は ${n} 件。まだ顔から当てられません。もう少し付き合って。`
  }
  const pct = Math.round(hitRate * 100)
  if (pct >= 85) return `${n} 件で ${pct}%。だいぶあなたのことがわかってきた。`
  if (pct >= 65) return `${n} 件で ${pct}%。少しずつ当たるようになってる。`
  return `${n} 件で ${pct}%。当たったり外したり。`
}
