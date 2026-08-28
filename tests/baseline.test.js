import { describe, it, expect } from 'vitest'
import { buildBaseline, toZ, sdFloor, pooledBaseline, Z_CLAMP } from '../src/lib/baseline.js'
import { FEATURE_NAMES } from '../src/lib/features.js'

const sample = (v) => Object.fromEntries(FEATURE_NAMES.map((n) => [n, v]))

describe('buildBaseline', () => {
  it('平均と SD を全特徴量について作る', () => {
    const b = buildBaseline([sample(1), sample(3), sample(5)])
    expect(b.sampleCount).toBe(3)
    for (const n of FEATURE_NAMES) {
      expect(b.mean[n]).toBeCloseTo(3, 9)
      expect(b.sd[n]).toBeCloseTo(2, 9)
    }
  })
  it('空なら null', () => expect(buildBaseline([])).toBeNull())
  it('欠けた特徴量は 0 として扱う', () => {
    const b = buildBaseline([{ eyeOpenL: 2 }, { eyeOpenL: 4 }])
    expect(b.mean.eyeOpenR).toBe(0)
  })
})

describe('sdFloor', () => {
  it('SD が十分大きければそのまま', () => expect(sdFloor(0.5, 1)).toBe(0.5))
  it('SD が潰れたら平均の 5% で下支えする', () => expect(sdFloor(0, 2)).toBeCloseTo(0.1, 9))
  it('平均も 0 なら最小値', () => expect(sdFloor(0, 0)).toBeCloseTo(1e-6, 12))
})

describe('toZ', () => {
  const b = buildBaseline([sample(1), sample(3), sample(5)])  // mean 3, sd 2

  it('平均そのものなら 0', () => {
    const z = toZ(sample(3), b)
    for (const n of FEATURE_NAMES) expect(z[n]).toBeCloseTo(0, 9)
  })
  it('1SD 上なら +1', () => expect(toZ(sample(5), b).eyeOpenL).toBeCloseTo(1, 9))
  it('1SD 下なら -1', () => expect(toZ(sample(1), b).eyeOpenL).toBeCloseTo(-1, 9))
  it(`外れ値は ±${Z_CLAMP} でクランプ`, () => {
    expect(toZ(sample(1000), b).eyeOpenL).toBe(Z_CLAMP)
    expect(toZ(sample(-1000), b).eyeOpenL).toBe(-Z_CLAMP)
  })
  it('ベースラインが無ければ全部 0', () => {
    const z = toZ(sample(99), null)
    for (const n of FEATURE_NAMES) expect(z[n]).toBe(0)
  })
  it('SD が 0 でも無限大にならない', () => {
    const flat = buildBaseline([sample(2), sample(2)])
    expect(Number.isFinite(toZ(sample(2.05), flat).eyeOpenL)).toBe(true)
  })
})

describe('追加ガード: num() の非有限値処理', () => {
  it('NaN は 0 に変換される', () => {
    const b = buildBaseline([{ eyeOpenL: NaN }, { eyeOpenL: 2 }])
    expect(b.mean.eyeOpenL).toBe(1)
  })
  it('Infinity は 0 に変換される', () => {
    const b = buildBaseline([{ eyeOpenL: Infinity }, { eyeOpenL: 2 }])
    expect(b.mean.eyeOpenL).toBe(1)
  })
  it('-Infinity は 0 に変換される', () => {
    const b = buildBaseline([{ eyeOpenL: -Infinity }, { eyeOpenL: 2 }])
    expect(b.mean.eyeOpenL).toBe(1)
  })
  it('null 値は 0 として扱われる', () => {
    const b = buildBaseline([{ eyeOpenL: null }, { eyeOpenL: 2 }])
    expect(b.mean.eyeOpenL).toBe(1)
  })
  it('undefined 値は 0 として扱われる', () => {
    const b = buildBaseline([{ eyeOpenL: undefined }, { eyeOpenL: 2 }])
    expect(b.mean.eyeOpenL).toBe(1)
  })
  it('Z スコアで非有限入力値も有限 Z になる', () => {
    const b = buildBaseline([sample(1), sample(3), sample(5)])  // mean 3, sd 2
    const z = toZ({ eyeOpenL: NaN }, b)
    // num(NaN) = 0 なので (0 - 3) / sdFloor(2, 3)=2 → -1.5
    expect(z.eyeOpenL).toBeCloseTo(-1.5, 9)
  })
})

describe('追加ガード: ベースラインのキーが不足したケース', () => {
  it('baseline.mean に特徴量キーがない場合', () => {
    const incomplete = { mean: {}, sd: { eyeOpenL: 1 }, sampleCount: 1 }
    const z = toZ(sample(5), incomplete)
    // num(undefined) = 0 なので (5 - 0) / sdFloor(1, 0) = 5 / 1 = 5
    expect(z.eyeOpenL).toBeCloseTo(5, 9)
  })
  it('baseline.sd に特徴量キーがない場合', () => {
    const incomplete = { mean: { eyeOpenL: 3 }, sd: {}, sampleCount: 1 }
    const z = toZ(sample(5), incomplete)
    // num(undefined) = 0 なので sdFloor(0, 3) = 0.15 → (5-3)/0.15 ≈ 13.3 → ±Z_CLAMP にクランプ
    expect(z.eyeOpenL).toBe(Z_CLAMP)
  })
})

describe('追加ガード: null/undefined 値を含むサンプル配列', () => {
  it('サンプル配列内に null サンプルがある場合', () => {
    const b = buildBaseline([sample(1), null, sample(3)])
    // null は { undefinedフィーチャー: undefined } 扱い → 0 に変換
    expect(b.sampleCount).toBe(3)
  })
  it('サンプル配列内に undefined サンプルがある場合', () => {
    const b = buildBaseline([sample(1), undefined, sample(3)])
    expect(b.sampleCount).toBe(3)
  })
})

describe('追加ガード: toZ が baseline.mean / baseline.sd 丸ごと欠落でも例外を投げない', () => {
  // Finding 2 の再現: toZ(sample, { sampleCount: 1 }) は
  // baseline.sd[n] / baseline.mean[n] への非オプショナルなアクセスで
  // TypeError: Cannot read properties of undefined を投げていた。
  it('sd キー自体が無いベースラインでも全部 0', () => {
    const z = toZ(sample(0), { mean: { eyeOpenL: 0 }, sampleCount: 1 })
    for (const n of FEATURE_NAMES) expect(z[n]).toBe(0)
  })
  it('mean キー自体が無いベースラインでも全部 0', () => {
    const z = toZ(sample(0), { sd: { eyeOpenL: 2 }, sampleCount: 1 })
    for (const n of FEATURE_NAMES) expect(z[n]).toBe(0)
  })
  it('mean も sd も丸ごと無いベースラインでも例外を投げず全部 0', () => {
    expect(() => toZ(sample(0), { sampleCount: 1 })).not.toThrow()
    const z = toZ(sample(0), { sampleCount: 1 })
    for (const n of FEATURE_NAMES) expect(z[n]).toBe(0)
  })
})

describe('pooledBaseline', () => {
  it('ベースラインが無ければ null', () => {
    expect(pooledBaseline(null, [{ features: sample(1) }])).toBeNull()
  })

  it('記録が空ならセットアップだけから作った場合と同じ平均・SD になる', () => {
    const setup = [sample(2), sample(4)]
    const b = buildBaseline(setup)
    const pooled = pooledBaseline(b, [])
    for (const n of FEATURE_NAMES) {
      expect(pooled.mean[n]).toBeCloseTo(b.mean[n], 9)
      expect(pooled.sd[n]).toBeCloseTo(b.sd[n], 9)
    }
  })

  it('features が欠けている・null の記録は無視する', () => {
    const b = buildBaseline([sample(2), sample(4)])  // mean 3
    const entries = [
      { features: null },
      { features: undefined },
      {},  // features キー自体が無い
      { features: sample(9) },
    ]
    const pooled = pooledBaseline(b, entries)
    // セットアップ 2 件（2,4）+ 有効な記録 1 件（9）の 3 件だけが混ざる
    expect(pooled.sampleCount).toBe(3)
    expect(pooled.mean.eyeOpenL).toBeCloseTo(5, 9)  // (2+4+9)/3
  })

  it('values 配列が無いベースラインでも例外を投げず記録を取り込む', () => {
    const oldBaseline = { mean: { eyeOpenL: 3 }, sd: { eyeOpenL: 1 }, sampleCount: 2 }
    const entries = [{ features: sample(5) }, { features: sample(7) }]
    expect(() => pooledBaseline(oldBaseline, entries)).not.toThrow()
    const pooled = pooledBaseline(oldBaseline, entries)
    expect(pooled.sampleCount).toBe(2)
    expect(pooled.mean.eyeOpenL).toBeCloseTo(6, 9)  // (5+7)/2
  })

  it('平均ゼロ付近の差分系特徴量が張り付いていた問題を修正する（回帰テスト）', () => {
    // セットアップの 5 枚は「同じ一回の撮影」で、ほぼ同じ値・平均ほぼ 0 の
    // 差分系特徴量（目の開きの左右差など）を再現する。
    const feat = (v) => ({ eyeOpenAsym: v })
    const setupSamples = [0.00000, 0.00006, -0.00003, 0.00009, -0.00012].map(feat)
    const setupBaseline = buildBaseline(setupSamples)

    const dailyVals = [0.001, 0.005, 0.02, 0.05]

    // 修正前と同じ状況：セットアップだけの基準では、現実的などの日々のズレも
    // 全部 ±Z_CLAMP に張り付き、情報が消える。
    const before = dailyVals.map((v) => toZ(feat(v), setupBaseline).eyeOpenAsym)
    for (const z of before) expect(z).toBe(Z_CLAMP)

    // 実際の記録が 10 件たまり、日々の本物のバラつきを持つようになった状況。
    const dailySpread = [-0.03, -0.02, -0.01, -0.005, 0.005, 0.01, 0.02, 0.03, -0.015, 0.015]
    const entries = dailySpread.map((v) => ({ features: feat(v) }))

    const pooled = pooledBaseline(setupBaseline, entries)
    const after = dailyVals.map((v) => toZ(feat(v), pooled).eyeOpenAsym)

    // もう ±Z_CLAMP に張り付かない
    for (const z of after) expect(Math.abs(z)).toBeLessThan(Z_CLAMP)
    // 各日々のズレが別々の Z スコアとして区別できる（情報が生きている）
    const rounded = after.map((z) => z.toFixed(6))
    expect(new Set(rounded).size).toBe(after.length)
    // 値が大きいズレほど Z も大きい（単調性）
    for (let i = 1; i < after.length; i++) expect(after[i]).toBeGreaterThan(after[i - 1])
  })
})
