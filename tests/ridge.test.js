import { describe, it, expect } from 'vitest'
import { fitRidge, predictRidge, looPredictions, selectLambda, LAMBDAS } from '../src/lib/ridge.js'

// 決定的な擬似乱数
function rng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

function makeData({ n = 60, d = 4, weights = [2, -1, 0.5, 0], noise = 0.05, seed = 1 } = {}) {
  const r = rng(seed)
  const X = [], y = []
  for (let i = 0; i < n; i++) {
    const row = Array.from({ length: d }, () => r() * 2 - 1)
    X.push(row)
    y.push(3 + row.reduce((s, v, j) => s + v * weights[j], 0) + (r() - 0.5) * 2 * noise)
  }
  return { X, y }
}

describe('fitRidge', () => {
  it('λ が小さければ真の重みを取り戻す', () => {
    const { X, y } = makeData({ n: 400, noise: 0.01, seed: 3 })
    const m = fitRidge(X, y, 0.001)
    expect(m.intercept).toBeCloseTo(3, 1)
    expect(m.w[0]).toBeCloseTo(2, 1)
    expect(m.w[1]).toBeCloseTo(-1, 1)
    expect(m.w[2]).toBeCloseTo(0.5, 1)
    expect(m.w[3]).toBeCloseTo(0, 1)
  })

  it('λ を大きくすると重みが 0 に縮む（切片は縮まない）', () => {
    const { X, y } = makeData({ n: 100, seed: 5 })
    const loose = fitRidge(X, y, 0.001)
    const tight = fitRidge(X, y, 1000)
    expect(Math.abs(tight.w[0])).toBeLessThan(Math.abs(loose.w[0]))
    expect(tight.intercept).toBeCloseTo(3, 1)
  })

  it('データが特徴量より少なくても λ>0 なら解ける', () => {
    const { X, y } = makeData({ n: 5, d: 15, weights: new Array(15).fill(0.2), seed: 9 })
    const m = fitRidge(X, y, 1)
    expect(m).not.toBeNull()
    expect(m.w).toHaveLength(15)
    for (const w of m.w) expect(Number.isFinite(w)).toBe(true)
  })

  it('データが空なら null', () => expect(fitRidge([], [], 1)).toBeNull())

  it('X と y の行数が合わないなら null', () => {
    const { X, y } = makeData({ n: 10, seed: 41 })
    expect(fitRidge(X, y.slice(0, 5), 1)).toBeNull()
  })

  it('共線な特徴量と λ=0 で正規方程式が特異なら null', () => {
    // 2 列目 = 1 列目 * 2 の完全な共線性。λ=0 だと切片以外を罰則で救えず特異になる。
    const r = rng(7)
    const X = [], y = []
    for (let i = 0; i < 8; i++) {
      const a = r() * 2 - 1
      X.push([a, 2 * a])
      y.push(r())
    }
    expect(fitRidge(X, y, 0)).toBeNull()
  })

  it('λ=0 でも λ で割ったりせず解ける', () => {
    const { X, y } = makeData({ n: 30, d: 2, weights: [2, -1], noise: 0.01, seed: 19 })
    const m = fitRidge(X, y, 0)
    expect(m).not.toBeNull()
    expect(m.lambda).toBe(0)
    expect(Number.isFinite(m.intercept)).toBe(true)
    for (const w of m.w) expect(Number.isFinite(w)).toBe(true)
  })
})

describe('predictRidge', () => {
  it('学習に使った点をだいたい再現する', () => {
    const { X, y } = makeData({ n: 200, noise: 0.01, seed: 11 })
    const m = fitRidge(X, y, 0.01)
    expect(predictRidge(m, X[0])).toBeCloseTo(y[0], 1)
  })

  it('model が null なら 0 を返す', () => {
    expect(predictRidge(null, [1, 2, 3])).toBe(0)
  })

  it('x が重みベクトルより短くても不足分を 0 扱いして落ちない', () => {
    const model = { intercept: 1, w: [2, 3, 4], lambda: 1, n: 10, d: 3 }
    expect(predictRidge(model, [5])).toBeCloseTo(1 + 2 * 5, 9)
  })
})

describe('looPredictions', () => {
  it('★総当たりの Leave-One-Out と厳密に一致する', () => {
    const { X, y } = makeData({ n: 30, d: 4, seed: 21 })
    const lambda = 2.5
    const fast = looPredictions(X, y, lambda)

    for (let i = 0; i < X.length; i++) {
      const Xi = X.filter((_, k) => k !== i)
      const yi = y.filter((_, k) => k !== i)
      const brute = predictRidge(fitRidge(Xi, yi, lambda), X[i])
      expect(fast[i]).toBeCloseTo(brute, 9)
    }
  })

  it('n が 3 未満なら null', () => {
    expect(looPredictions([[1], [2]], [1, 2], 1)).toBeNull()
  })

  it('返す個数は行数と同じ', () => {
    const { X, y } = makeData({ n: 12, seed: 4 })
    expect(looPredictions(X, y, 1)).toHaveLength(12)
  })

  it('行数 = 特徴量数+1 かつ λ=0 だと 1-h_ii が 0 になり平均へフォールバックする', () => {
    // 拡張設計行列 Xa が正方かつ正則だと、あらゆる点で h_ii=1（完全な補間）になり
    // ŷ⁽⁻ⁱ⁾ = y_i − e_i/(1-h_ii) が 0 除算になる。yMean へのフォールバックで救う。
    const { X, y } = makeData({ n: 4, d: 3, weights: [1, -1, 0.5], seed: 41 })
    const p = looPredictions(X, y, 0)
    const yMean = y.reduce((s, v) => s + v, 0) / y.length
    expect(p).not.toBeNull()
    for (const v of p) expect(v).toBeCloseTo(yMean, 9)
  })
})

describe('selectLambda', () => {
  it('ノイズが大きいデータでは大きい λ を選ぶ', () => {
    const clean = makeData({ n: 40, noise: 0.01, seed: 31 })
    const noisy = makeData({ n: 40, noise: 3.0, seed: 31 })
    const a = selectLambda(clean.X, clean.y)
    const b = selectLambda(noisy.X, noisy.y)
    expect(b.lambda).toBeGreaterThan(a.lambda)
  })

  it('候補の中から選ぶ', () => {
    const { X, y } = makeData({ n: 40, seed: 33 })
    expect(LAMBDAS).toContain(selectLambda(X, y).lambda)
  })

  it('LOO が計算できないときは一番大きい λ を返す', () => {
    const r = selectLambda([[1]], [1])
    expect(r.lambda).toBe(LAMBDAS[LAMBDAS.length - 1])
  })

  it('行数は足りていても全候補で正規方程式が特異なら最後の候補にフォールバックする', () => {
    // n=5 で 3 以上あり looPredictions 自体は走るが、共線な特徴量＋λ=0 で
    // fitRidge が毎回 null を返すため、どの候補も採用できない。
    const r = rng(17)
    const X = [], y = []
    for (let i = 0; i < 5; i++) {
      const a = r() * 2 - 1
      X.push([a, 2 * a])
      y.push(r())
    }
    const result = selectLambda(X, y, [0])
    expect(result.lambda).toBe(0)
    expect(result.sse).toBe(Infinity)
  })
})
