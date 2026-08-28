import { describe, it, expect } from 'vitest'
import { buildBaseline, toZ, sdFloor, updateBaseline, Z_CLAMP } from '../src/lib/baseline.js'
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

describe('updateBaseline', () => {
  it('記録を足すと sampleCount が増え、平均が動く', () => {
    const b = buildBaseline([sample(2), sample(4)])
    const b2 = updateBaseline(b, sample(6))
    expect(b2.sampleCount).toBe(3)
    expect(b2.mean.eyeOpenL).toBeCloseTo(4, 9)
  })
  it('ベースラインが無ければ 1 件から作る', () => {
    const b = updateBaseline(null, sample(5))
    expect(b.sampleCount).toBe(1)
    expect(b.mean.eyeOpenL).toBe(5)
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
    const b = buildBaseline([sample(1), sample(3), sample(5)])
    const z = toZ({ eyeOpenL: NaN }, b)
    expect(Number.isFinite(z.eyeOpenL)).toBe(true)
  })
})

describe('追加ガード: sdFloor の三路分岐', () => {
  it('1e-6 が最小値として機能する', () => {
    // 平均 0 で SD 0 の場合、1e-6 が選ばれる
    expect(sdFloor(0, 0)).toBe(1e-6)
  })
  it('5% の腕が選ばれるケース', () => {
    // SD=0、平均=2 なら 0.05*2 = 0.1 が選ばれる
    const result = sdFloor(0, 2)
    expect(result).toBe(0.1)
  })
  it('生 SD が選ばれるケース', () => {
    // SD=0.5 で平均=1 なら 0.5 > 0.05 なので SD が選ばれる
    expect(sdFloor(0.5, 1)).toBe(0.5)
  })
})

describe('追加ガード: ベースラインのキーが不足したケース', () => {
  it('baseline.mean に特徴量キーがない場合', () => {
    const incomplete = { mean: {}, sd: { eyeOpenL: 1 }, sampleCount: 1 }
    const z = toZ(sample(5), incomplete)
    // num(undefined) = 0 なので (5 - 0) / sdFloor(1, 0) = 5 / 1 = 5
    expect(Number.isFinite(z.eyeOpenL)).toBe(true)
    expect(z.eyeOpenL).toBeCloseTo(5, 9)
  })
  it('baseline.sd に特徴量キーがない場合', () => {
    const incomplete = { mean: { eyeOpenL: 3 }, sd: {}, sampleCount: 1 }
    const z = toZ(sample(5), incomplete)
    expect(Number.isFinite(z.eyeOpenL)).toBe(true)
  })
})

describe('追加ガード: updateBaseline の旧形式ベースライン対応', () => {
  it('values 配列がない旧形式ベースラインからでも更新できる', () => {
    const oldBaseline = { mean: { eyeOpenL: 3 }, sd: { eyeOpenL: 1 }, sampleCount: 2 }
    const b2 = updateBaseline(oldBaseline, sample(4))
    expect(b2.sampleCount).toBe(1) // values がないので新規作成される
    expect(b2.mean.eyeOpenL).toBe(4)
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
