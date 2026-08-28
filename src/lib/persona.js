import { FEATURE_LABELS_JA } from './features.js'
import { clampScale } from './labels.js'

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
const OPENERS_HIGH = ['今日ははっきりしてる。', '今日はわかりやすい。', '顔に書いてある。']

const CONDITION = {
  1: 'かなりしんどそう', 2: 'すこし疲れが残ってる', 3: 'ふつう',
  4: '調子はいいほう', 5: 'かなり good',
}
const MOOD = {
  1: 'かなり沈んでそう', 2: 'すこし沈んでる', 3: '機嫌はふつう',
  4: '機嫌はよさそう', 5: 'かなり機嫌がいい',
}
const SLEEPINESS = {
  1: 'ぱっちりしてる', 2: '眠くはなさそう', 3: 'ふつう',
  4: 'ちょっと眠そう', 5: 'だいぶ眠そう',
}

export function speak({ values, confidence, topFeature, seed = '' }) {
  const parts = []
  if (Number.isFinite(values?.condition)) parts.push(CONDITION[clampScale(values.condition)])
  if (Number.isFinite(values?.mood)) parts.push(MOOD[clampScale(values.mood)])
  if (Number.isFinite(values?.sleepiness)) parts.push(SLEEPINESS[clampScale(values.sleepiness)])
  const body = parts.length ? parts.join('。') + '。' : '今日はなんとも言えない。'

  // 話す中身が無いときに自信満々な出だしを選ぶと、直後の「今日はなんとも言えない。」と
  // 矛盾してしまう。中身が無ければ confidence の値に関わらず必ず控えめな出だしにする。
  const openers = parts.length === 0
    ? OPENERS_LOW
    : confidence < 0.35 ? OPENERS_LOW : confidence < 0.7 ? OPENERS_MID : OPENERS_HIGH
  const opener = pick(openers, seed + 'o')

  const because = topFeature && Object.hasOwn(FEATURE_LABELS_JA, topFeature)
    ? `${FEATURE_LABELS_JA[topFeature]}に出てる。`
    : ''

  return `${opener}${body}${because}`
}

export function growLine({ usable, n, hitRate }) {
  const count = Number.isFinite(n) ? n : 0
  // hitRate が非数（未計測・NaN）なら、当てられているかどうか自体が分からない
  // ＝ usable=false と同じ「まだ当てられません」扱いにする。
  if (!usable || !Number.isFinite(hitRate)) {
    return `記録は ${count} 件。まだ顔から当てられません。もう少し付き合って。`
  }
  const pct = Math.round(hitRate * 100)
  if (pct >= 85) return `${count} 件で ${pct}%。だいぶあなたのことがわかってきた。`
  if (pct >= 65) return `${count} 件で ${pct}%。少しずつ当たるようになってる。`
  return `${count} 件で ${pct}%。当たったり外したり。`
}
