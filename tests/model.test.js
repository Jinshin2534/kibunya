import { describe, it, expect } from 'vitest'
import {
  MIN_ENTRIES, hitRate, rSquared, trainTarget, trainAll,
  importance, confidenceOf, predictAll, learningCurve,
} from '../src/lib/model.js'
import { FEATURE_NAMES } from '../src/lib/features.js'

function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

// baseline を毎回通す trainTarget に合わせて、恒等変換になるベースライン
// （mean 0, sd 1）を使う。こうすると toZ(features, IDENTITY_BASELINE) は
// features をそのまま返すので、以前 z を直接生成していたテストの意図を保てる。
// sampleCount >= 2 が無いと toZ は「基準が使えない」と判断して全て 0 を
// 返してしまう（src/lib/baseline.js のガード）ため、ここで明示的に与える。
const IDENTITY_BASELINE = {
  mean: Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0])),
  sd: Object.fromEntries(FEATURE_NAMES.map((n) => [n, 1])),
  sampleCount: 2,
}

// eyeOpenL が高い日ほど体調が良い、という嘘のない相関を持つ記録を作る
function makeEntries(n, { signal = 1, seed = 2 } = {}) {
  const r = rng(seed)
  const out = []
  for (let i = 0; i < n; i++) {
    const features = Object.fromEntries(FEATURE_NAMES.map((name) => [name, r() * 2 - 1]))
    const raw = 3 + signal * 2 * features.eyeOpenL + (r() - 0.5) * 0.2
    const v = Math.max(1, Math.min(5, Math.round(raw)))
    out.push({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, features,
               labels: { condition: v, mood: 3, sleepiness: v } })
  }
  return out
}

describe('hitRate / rSquared', () => {
  it('±1 以内を当たりとする', () => {
    expect(hitRate([3, 3, 3, 3], [3, 4, 2, 5])).toBeCloseTo(0.75, 9)
  })
  it('完全一致なら 1', () => expect(hitRate([1, 2], [1, 2])).toBe(1))
  it('空なら 0', () => expect(hitRate([], [])).toBe(0))
  it('R² は完全一致で 1', () => expect(rSquared([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 9))
  it('平均を答えるだけなら R² は 0', () => {
    expect(rSquared([1, 2, 3], [2, 2, 2])).toBeCloseTo(0, 9)
  })
  it('平均より悪ければ R² は負', () => {
    expect(rSquared([1, 2, 3], [3, 2, 1])).toBeLessThan(0)
  })
  it('実測に分散が無ければ null', () => expect(rSquared([2, 2, 2], [1, 2, 3])).toBeNull())
})

describe('trainTarget', () => {
  it(`記録が ${MIN_ENTRIES} 件未満なら null`, () => {
    expect(trainTarget(makeEntries(MIN_ENTRIES - 1), 'condition', IDENTITY_BASELINE)).toBeNull()
  })

  it('相関がある的は学習でき、usable になる', () => {
    const t = trainTarget(makeEntries(60, { signal: 1, seed: 7 }), 'condition', IDENTITY_BASELINE)
    expect(t.n).toBe(60)
    expect(t.r2).toBeGreaterThan(0.3)
    expect(t.hitRate).toBeGreaterThan(0.7)
    expect(t.usable).toBe(true)
  })

  it('顔と無関係な的は usable にならない', () => {
    const entries = makeEntries(60, { seed: 13 }).map((e, i) => ({
      ...e, labels: { ...e.labels, mood: (i % 5) + 1 },  // 顔と無関係
    }))
    const t = trainTarget(entries, 'mood', IDENTITY_BASELINE)
    expect(t.usable).toBe(false)
  })

  it('答えがずっと同じなら usable にならない', () => {
    const entries = makeEntries(20).map((e) => ({ ...e, labels: { ...e.labels, condition: 3 } }))
    expect(trainTarget(entries, 'condition', IDENTITY_BASELINE).usable).toBe(false)
  })
})

describe('importance', () => {
  it('効いている特徴量が上に来て、日本語名が付く', () => {
    const t = trainTarget(makeEntries(80, { seed: 17 }), 'condition', IDENTITY_BASELINE)
    const top = importance(t.model)[0]
    expect(top.feature).toBe('eyeOpenL')
    expect(top.label).toBe('左目の開き')
  })
  it('モデルが無ければ空配列', () => expect(importance(null)).toEqual([]))
})

describe('confidenceOf', () => {
  const z = Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0]))
  it('0〜1 に収まる', () => {
    expect(confidenceOf({ r2: 0.8, n: 100, z })).toBeGreaterThan(0)
    expect(confidenceOf({ r2: 0.8, n: 100, z })).toBeLessThanOrEqual(1)
  })
  it('記録が多いほど高い', () => {
    expect(confidenceOf({ r2: 0.8, n: 100, z })).toBeGreaterThan(confidenceOf({ r2: 0.8, n: 6, z }))
  })
  it('当たっていないほど低い', () => {
    expect(confidenceOf({ r2: 0.1, n: 50, z })).toBeLessThan(confidenceOf({ r2: 0.9, n: 50, z }))
  })
  it('見たことのない顔の日は下がる', () => {
    const odd = { ...z, eyeOpenL: 5 }
    expect(confidenceOf({ r2: 0.8, n: 50, z: odd }))
      .toBeLessThan(confidenceOf({ r2: 0.8, n: 50, z }))
  })
  it('R² が負でも 0 未満にならない', () => {
    expect(confidenceOf({ r2: -3, n: 50, z })).toBeGreaterThanOrEqual(0)
  })
})

describe('predictAll', () => {
  it('使える的だけ予測を返す', () => {
    const entries = makeEntries(60, { seed: 23 })
    const trained = trainAll(entries, IDENTITY_BASELINE)
    const p = predictAll(trained, entries[0].features)
    expect(p.values.condition).toBeGreaterThanOrEqual(1)
    expect(p.values.condition).toBeLessThanOrEqual(5)
    expect(p.perTarget.mood.usable).toBe(false)
  })
  it('使える的が1つも無ければ null', () => {
    expect(predictAll(trainAll(makeEntries(3), IDENTITY_BASELINE), makeEntries(1)[0].features)).toBeNull()
  })
  it('予測は 1〜5 に収める', () => {
    const entries = makeEntries(60, { signal: 6, seed: 29 })
    const p = predictAll(trainAll(entries, IDENTITY_BASELINE), Object.fromEntries(FEATURE_NAMES.map((n) => [n, 6])))
    expect(p.values.condition).toBeLessThanOrEqual(5)
    expect(p.values.condition).toBeGreaterThanOrEqual(1)
  })
  // 上の「予測は 1〜5 に収める」は上限側（+6）しか踏んでいない。
  // eyeOpenL に正の傾きが学習される signal:6 の設定で、下限側（-6）も別途踏む。
  // 元の実装が clampScale で min のみ・max のみを掛け違えていた場合はここで壊れる。
  it('予測は下限側でも 1〜5 に収める', () => {
    const entries = makeEntries(60, { signal: 6, seed: 29 })
    const p = predictAll(trainAll(entries, IDENTITY_BASELINE), Object.fromEntries(FEATURE_NAMES.map((n) => [n, -6])))
    expect(p.values.condition).toBeGreaterThanOrEqual(1)
    expect(p.values.condition).toBeLessThanOrEqual(5)
  })
})

describe('learningCurve', () => {
  it(`${MIN_ENTRIES} 件目から 1 件ずつ的中率を返す`, () => {
    const curve = learningCurve(makeEntries(20, { seed: 31 }), 'condition', IDENTITY_BASELINE)
    expect(curve[0].n).toBe(MIN_ENTRIES)
    expect(curve[curve.length - 1].n).toBe(20)
    for (const p of curve) {
      expect(p.hitRate).toBeGreaterThanOrEqual(0)
      expect(p.hitRate).toBeLessThanOrEqual(1)
    }
  })
  it('記録が足りなければ空', () => {
    expect(learningCurve(makeEntries(2), 'condition', IDENTITY_BASELINE)).toEqual([])
  })
  // MIN_ENTRIES は満たしているが、途中の1件だけラベルが欠損している場合。
  // trainTarget は「非数値ラベルがあれば null」を返すので、その欠損記録を
  // 含む先頭 k 件（k >= 欠損位置+1）は以降ずっと学習できない。
  // 一部の k だけ結果が飛ぶ（穴が開く）のではなく、そこで打ち切られることを確認する。
  it('途中の記録にラベル欠損があると、それを含む k 以降は結果に出ない', () => {
    const entries = makeEntries(20, { seed: 43 }).map((e, i) =>
      (i === 7 ? { ...e, labels: { ...e.labels, condition: undefined } } : e))
    const curve = learningCurve(entries, 'condition', IDENTITY_BASELINE)
    // 欠損は 8 番目（index 7）の記録なので、先頭 5,6,7 件までは欠損を含まず学習できる。
    // 先頭 8 件目以降は必ず欠損記録を含むので、以降の k はすべて欠落する。
    expect(curve.map((p) => p.n)).toEqual([5, 6, 7])
  })
})

describe('rSquared の追加ガード', () => {
  it('空配列なら null（分散 0 と同じ扱い）', () => {
    expect(rSquared([], [])).toBeNull()
  })
})

describe('hitRate のカスタム許容誤差', () => {
  it('許容誤差ちょうどは当たり（<= であって < ではない）', () => {
    // 差がちょうど tol(=2) のとき、境界を <= で判定していれば当たり、
    // < で判定する誤実装ならここで外れて 0 になる。
    expect(hitRate([2], [4], 2)).toBe(1)
  })
  it('許容誤差をわずかに超えると外れ', () => {
    expect(hitRate([2], [4], 1.999)).toBe(0)
  })
  it('カスタム許容誤差で複数件を判定する', () => {
    // 差 = [2, 0, 2]。tol=2 なら全部当たり、tol=1 なら中央の1件だけ当たり。
    expect(hitRate([1, 2, 3], [3, 2, 1], 2)).toBeCloseTo(1, 9)
    expect(hitRate([1, 2, 3], [3, 2, 1], 1)).toBeCloseTo(1 / 3, 9)
  })
})

describe('trainTarget の追加ガード', () => {
  it('ラベルが非数値（文字列）な記録が1件でもあれば null', () => {
    const entries = makeEntries(10, { seed: 41 }).map((e, i) =>
      (i === 3 ? { ...e, labels: { ...e.labels, condition: 'ふつう' } } : e))
    expect(trainTarget(entries, 'condition', IDENTITY_BASELINE)).toBeNull()
  })
  it('ラベルが欠損（undefined）な記録が1件でもあれば null', () => {
    const entries = makeEntries(10, { seed: 41 }).map((e, i) =>
      (i === 3 ? { ...e, labels: { ...e.labels, condition: undefined } } : e))
    expect(trainTarget(entries, 'condition', IDENTITY_BASELINE)).toBeNull()
  })
  // looPredictions / fitRidge が null を返す経路（trainTarget 内の
  // `if (!model || !loo) return null`）は、MIN_ENTRIES=5 が
  // looPredictions の必要条件（X.length >= 3）を常に満たし、かつ
  // リッジの正則化項（λ>0）が特徴量側の対角成分を必ず底上げするため、
  // 全行が同一・全行ゼロといった極端な退化データでも自然には踏めないことを
  // 直接 ridge.js を叩いて確認済み（スクリプトで検証、null にならない）。
  // そのためモック無しでは再現できず、ここでは意図的にテストを追加していない。
})

describe('importance の追加ガード', () => {
  it('重みが全部ゼロでも FEATURE_NAMES と同じ並び・同じ本数で返る', () => {
    const model = { w: new Array(FEATURE_NAMES.length).fill(0), intercept: 0 }
    const imp = importance(model)
    expect(imp.map((x) => x.feature)).toEqual(FEATURE_NAMES)
    expect(imp).toHaveLength(FEATURE_NAMES.length)
    expect(imp.every((x) => x.weight === 0)).toBe(true)
  })
  it('重みと特徴量名の対応がインデックスでずれない', () => {
    // 各特徴量に別々の重みを与え、最大重みの特徴量が正しく先頭に来るか、
    // 全特徴量の重みが元のインデックス通りに引けるかを確認する。
    const w = FEATURE_NAMES.map((_, j) => j + 1)
    const model = { w, intercept: 0 }
    const imp = importance(model)
    expect(imp[0].feature).toBe(FEATURE_NAMES[FEATURE_NAMES.length - 1])
    expect(imp[0].weight).toBe(FEATURE_NAMES.length)
    const byFeature = Object.fromEntries(imp.map((x) => [x.feature, x.weight]))
    FEATURE_NAMES.forEach((f, j) => expect(byFeature[f]).toBe(j + 1))
  })
})

describe('confidenceOf の追加ガード', () => {
  const z0 = Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0]))
  it('r2 が null でも例外にならず、r2=0 と同じ最低保証点で評価される', () => {
    const withNull = confidenceOf({ r2: null, n: 50, z: z0 })
    const withZero = confidenceOf({ r2: 0, n: 50, z: z0 })
    expect(withNull).toBeCloseTo(withZero, 9)
    expect(withNull).toBeGreaterThan(0)
  })
  // null は Math.min(1, null) が 0 に強制変換されるため ?? 0 が無くても
  // 偶然壊れない。r2 キー自体が無い（undefined）場合は Math.min(1, undefined)
  // が NaN になり ?? 0 が無いと即座に破綻するので、そちらも別途踏む。
  it('r2 が undefined（キー自体が無い）でも NaN にならない', () => {
    const withMissing = confidenceOf({ n: 50, z: z0 })
    expect(Number.isNaN(withMissing)).toBe(false)
    expect(withMissing).toBeGreaterThanOrEqual(0)
    expect(withMissing).toBeLessThanOrEqual(1)
  })
  it('n が 0 なら信頼度は 0', () => {
    expect(confidenceOf({ r2: 0.8, n: 0, z: z0 })).toBe(0)
  })
  it('z が空でも例外にならず、全部 0 のときと同じ扱いになる', () => {
    const withEmpty = confidenceOf({ r2: 0.8, n: 50, z: {} })
    const withZero = confidenceOf({ r2: 0.8, n: 50, z: z0 })
    expect(withEmpty).toBeCloseTo(withZero, 9)
  })
})
