import { fitRidge, predictRidge, looPredictions, selectLambda } from './ridge.js'
import { FEATURE_NAMES, FEATURE_LABELS_JA, toVector } from './features.js'
import { TARGET_KEYS, SCALE_MIN, SCALE_MAX } from './labels.js'
import { toZ, pooledBaseline } from './baseline.js'
import { mean } from './stats.js'

export const MIN_ENTRIES = 5

export function hitRate(yTrue, yPred, tol = 1) {
  if (!yTrue.length) return 0
  let hit = 0
  for (let i = 0; i < yTrue.length; i++) if (Math.abs(yTrue[i] - yPred[i]) <= tol) hit++
  return hit / yTrue.length
}

export function rSquared(yTrue, yPred) {
  const m = mean(yTrue)
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < yTrue.length; i++) {
    ssRes += (yTrue[i] - yPred[i]) ** 2
    ssTot += (yTrue[i] - m) ** 2
  }
  if (ssTot < 1e-12) return null
  return 1 - ssRes / ssTot
}

// X は保存済みの entry.z ではなく、生の features を毎回 baseline で Z 化して作る。
// entry.z は撮影時点のベースラインで固定されているので、Task 7 のプール化で
// ベースラインが引き直されるたびに古くなる（陳腐化する）。学習のたびに
// 最新の baseline で作り直せば、その古さを持ち込まない。
function designOf(entries, key, baseline) {
  const X = entries.map((e) => toVector(toZ(e.features, baseline)))
  const y = entries.map((e) => e.labels?.[key])
  return { X, y }
}

/**
 * 1つの的（体調・気分・眠さ）を学習し、LOO で本当の成績を測る。
 * usable = 「平均を答えるより良い」かどうか。ここが false なら予測を出さない。
 */
export function trainTarget(entries, key, baseline) {
  if (!entries || entries.length < MIN_ENTRIES) return null
  const { X, y } = designOf(entries, key, baseline)
  if (y.some((v) => !Number.isFinite(v))) return null

  const { lambda } = selectLambda(X, y)
  const model = fitRidge(X, y, lambda)
  const loo = looPredictions(X, y, lambda)
  if (!model || !loo) return null

  const r2 = rSquared(y, loo)
  return {
    model, loo, lambda, n: entries.length,
    hitRate: hitRate(y, loo),
    r2,
    usable: r2 !== null && r2 > 0,
  }
}

export function trainAll(entries, baseline) {
  const out = {}
  for (const key of TARGET_KEYS) out[key] = trainTarget(entries, key, baseline)
  return out
}

export function importance(model) {
  if (!model) return []
  return FEATURE_NAMES
    .map((feature, j) => ({ feature, label: FEATURE_LABELS_JA[feature], weight: model.w[j] ?? 0 }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
}

/**
 * 自信度 = 記録の量 × 当たり具合 × 「今日の顔が見慣れているか」。
 * どれか1つでも低ければ低く出る。高く出るのは、たくさん記録があって、
 * 実際に当たっていて、今日の顔が過去の範囲に収まっているときだけ。
 */
export function confidenceOf({ r2, n, z }) {
  const dataScore = Math.min(1, (n ?? 0) / 20)
  const fitScore = Math.max(0, Math.min(1, r2 ?? 0))
  const maxAbsZ = Math.max(0, ...FEATURE_NAMES.map((k) => Math.abs(z?.[k] ?? 0)))
  const novelty = maxAbsZ <= 2 ? 1 : Math.max(0.4, 1 - (maxAbsZ - 2) / 6)
  return Math.max(0, Math.min(1, dataScore * (0.25 + 0.75 * fitScore) * novelty))
}

const clampScale = (v) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, v))

/**
 * 的ごとの「使えるか／使えないなら何故か」を出す。predictAll と、
 * predictAll が null を返す（=1つも使える的が無い）場面の両方から使われる。
 * 後者では predictAll 自身は null しか返せない（値が1つも無いので）が、
 * 呼び出し側（app.js の predictFor）はここを別途呼んで reason だけ取り出し、
 * 「記録がまだ足りない」のか「これだけあっても顔からは読み取れない」のかを
 * 画面（today.js）に正直に伝える。
 */
export function perTargetOf(trained, z) {
  const perTarget = {}
  for (const key of TARGET_KEYS) {
    const t = trained?.[key]
    if (!t) { perTarget[key] = { usable: false, reason: 'まだ記録が足りない' }; continue }
    const conf = confidenceOf({ r2: t.r2, n: t.n, z })
    perTarget[key] = {
      usable: t.usable, r2: t.r2, hitRate: t.hitRate, n: t.n, confidence: conf,
      reason: t.usable ? null : '顔からは読み取れない',
    }
  }
  return perTarget
}

export function predictAll(trained, z) {
  const x = toVector(z)
  const perTarget = perTargetOf(trained, z)
  const values = {}
  const confidences = []

  for (const key of TARGET_KEYS) {
    const t = trained?.[key]
    if (!t || !t.usable) continue
    values[key] = clampScale(predictRidge(t.model, x))
    confidences.push(perTarget[key].confidence)
  }

  if (!confidences.length) return null
  return { values, perTarget, confidence: mean(confidences) }
}

export function learningCurve(entries, key, baseline) {
  const curve = []
  for (let k = MIN_ENTRIES; k <= entries.length; k++) {
    const prefix = entries.slice(0, k)
    // baseline はここまでの記録（prefix）だけから毎回引き直す。
    // 最終形（全期間）でプールした基準を全ての点に使い回すと、k=5 の点が
    // まだ起きていない k=6〜末尾の記録の統計で測られることになり、
    // 「その時点でどれだけ賢かったか」を表す学習曲線が先読みで歪む。
    const scale = pooledBaseline(baseline, prefix)
    const t = trainTarget(prefix, key, scale)
    if (t) curve.push({ n: k, hitRate: t.hitRate })
  }
  return curve
}
