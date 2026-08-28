import { describe, it, expect } from 'vitest'
import { checkQuality, THRESHOLDS } from '../src/lib/quality.js'

const good = {
  faceFound: true, offAxisDeg: 3, rollDeg: 2,
  scalePx: 84, imageWidth: 640, faceLuminance: 130, motion: 0.004,
}
const keyOf = (r, key) => r.checks.find((c) => c.key === key)

describe('checkQuality', () => {
  it('全部良ければ ok', () => {
    const r = checkQuality(good)
    expect(r.ok).toBe(true)
    expect(r.checks.every((c) => c.ok)).toBe(true)
  })

  it('顔が見つからなければ ok にならず、他の項目も落ちる', () => {
    const r = checkQuality({ ...good, faceFound: false })
    expect(r.ok).toBe(false)
    expect(keyOf(r, 'face').ok).toBe(false)
  })

  it('正面から外れると落ちる', () => {
    expect(checkQuality({ ...good, offAxisDeg: THRESHOLDS.offAxisDeg + 0.1 }).ok).toBe(false)
    expect(checkQuality({ ...good, offAxisDeg: THRESHOLDS.offAxisDeg }).ok).toBe(true)
  })

  it('傾きすぎると落ちる', () => {
    expect(checkQuality({ ...good, rollDeg: -(THRESHOLDS.rollDeg + 0.1) }).ok).toBe(false)
    expect(checkQuality({ ...good, rollDeg: THRESHOLDS.rollDeg }).ok).toBe(true)
  })

  it('顔が小さすぎても大きすぎても落ちる', () => {
    const w = 640
    expect(checkQuality({ ...good, imageWidth: w, scalePx: w * (THRESHOLDS.scaleMin - 0.01) }).ok).toBe(false)
    expect(checkQuality({ ...good, imageWidth: w, scalePx: w * (THRESHOLDS.scaleMax + 0.01) }).ok).toBe(false)
    expect(checkQuality({ ...good, imageWidth: w, scalePx: w * THRESHOLDS.scaleMin }).ok).toBe(true)
  })

  it('暗すぎ・明るすぎで落ちる', () => {
    expect(checkQuality({ ...good, faceLuminance: THRESHOLDS.lumMin - 1 }).ok).toBe(false)
    expect(checkQuality({ ...good, faceLuminance: THRESHOLDS.lumMax + 1 }).ok).toBe(false)
  })

  it('動いている間は落ちる', () => {
    expect(checkQuality({ ...good, motion: THRESHOLDS.motion + 0.001 }).ok).toBe(false)
  })

  it('落ちた項目には日本語のヒントが付く', () => {
    const r = checkQuality({ ...good, offAxisDeg: 40 })
    const c = keyOf(r, 'direction')
    expect(c.ok).toBe(false)
    expect(c.hint.length).toBeGreaterThan(0)
    expect(c.label).toBe('顔の向き')
  })

  it('検査項目は 6 つ、順番は固定', () => {
    expect(checkQuality(good).checks.map((c) => c.key))
      .toEqual(['face', 'direction', 'tilt', 'size', 'light', 'still'])
  })
})

describe('checkQuality — guard tests', () => {
  it('引数なしでも動き、全て落ちる', () => {
    const r = checkQuality()
    expect(r.ok).toBe(false)
    expect(r.checks.every((c) => !c.ok)).toBe(true)
  })

  it('部分的なオブジェクトで呼んでも動き、faceFound=false として処理', () => {
    const r = checkQuality({ offAxisDeg: 3 })
    expect(r.ok).toBe(false)
    expect(keyOf(r, 'face').ok).toBe(false)
  })

  it('imageWidth=0 でも NaN や Infinity にならない', () => {
    const r = checkQuality({ ...good, imageWidth: 0 })
    const sizeCheck = keyOf(r, 'size')
    expect(sizeCheck.ok).toBe(false)
    // hint の計算で ratio = 0 になるが、0 < scaleMin で下ブランチ
    expect(sizeCheck.hint).toBe('もう少し近づいてください')
    expect(r.ok).toBe(false) // 全体としても落ちる
  })

  it('正のrollDeg が閾値を超えると落ちる', () => {
    expect(checkQuality({ ...good, rollDeg: THRESHOLDS.rollDeg + 0.1 }).ok).toBe(false)
  })

  it('顔が小さすぎるときのサイズヒントは「近づいて」', () => {
    const w = 640
    const r = checkQuality({ ...good, imageWidth: w, scalePx: w * (THRESHOLDS.scaleMin - 0.01) })
    const sizeCheck = keyOf(r, 'size')
    expect(sizeCheck.hint).toBe('もう少し近づいてください')
  })

  it('顔が大きすぎるときのサイズヒントは「離れて」', () => {
    const w = 640
    const r = checkQuality({ ...good, imageWidth: w, scalePx: w * (THRESHOLDS.scaleMax + 0.01) })
    const sizeCheck = keyOf(r, 'size')
    expect(sizeCheck.hint).toBe('もう少し離れてください')
  })

  it('暗いときの明るさヒントは「明るい場所へ」', () => {
    const r = checkQuality({ ...good, faceLuminance: THRESHOLDS.lumMin - 1 })
    const lightCheck = keyOf(r, 'light')
    expect(lightCheck.hint).toBe('もっと明るい場所へ')
  })

  it('明るすぎるときの明るさヒントは「光を弱めて」', () => {
    const r = checkQuality({ ...good, faceLuminance: THRESHOLDS.lumMax + 1 })
    const lightCheck = keyOf(r, 'light')
    expect(lightCheck.hint).toBe('まぶしすぎます。光を弱めてください')
  })

  it('顔が見つからないと全ての項目の ok が false', () => {
    const r = checkQuality({ faceFound: false, offAxisDeg: 5, rollDeg: 5, scalePx: 84, imageWidth: 640, faceLuminance: 130, motion: 0.004 })
    expect(r.checks.filter((c) => c.key !== 'face').every((c) => !c.ok)).toBe(true)
  })

  it('境界値: lumMin ちょうどは合格', () => {
    expect(checkQuality({ ...good, faceLuminance: THRESHOLDS.lumMin }).ok).toBe(true)
  })

  it('境界値: lumMax ちょうどは合格', () => {
    expect(checkQuality({ ...good, faceLuminance: THRESHOLDS.lumMax }).ok).toBe(true)
  })

  it('境界値: scaleMax ちょうどは合格', () => {
    const w = 640
    expect(checkQuality({ ...good, imageWidth: w, scalePx: w * THRESHOLDS.scaleMax }).ok).toBe(true)
  })

  it('motion ちょうど閾値は合格', () => {
    expect(checkQuality({ ...good, motion: THRESHOLDS.motion }).ok).toBe(true)
  })
})

describe('checkQuality — 未測定は不合格', () => {
  it('motion 以外は揃っていても motion 未指定だと ok にならない', () => {
    const r = checkQuality({
      faceFound: true, offAxisDeg: 3, rollDeg: 2,
      scalePx: 84, imageWidth: 640, faceLuminance: 130,
    })
    expect(r.ok).toBe(false)
    expect(keyOf(r, 'still').ok).toBe(false)
  })

  it('offAxisDeg が未指定/NaN だと direction が落ちる', () => {
    expect(keyOf(checkQuality({ ...good, offAxisDeg: undefined }), 'direction').ok).toBe(false)
    expect(keyOf(checkQuality({ ...good, offAxisDeg: NaN }), 'direction').ok).toBe(false)
  })

  it('rollDeg が未指定/NaN だと tilt が落ちる', () => {
    expect(keyOf(checkQuality({ ...good, rollDeg: undefined }), 'tilt').ok).toBe(false)
    expect(keyOf(checkQuality({ ...good, rollDeg: NaN }), 'tilt').ok).toBe(false)
  })

  it('scalePx が未指定/NaN だと size が落ちる', () => {
    expect(keyOf(checkQuality({ ...good, scalePx: undefined }), 'size').ok).toBe(false)
    expect(keyOf(checkQuality({ ...good, scalePx: NaN }), 'size').ok).toBe(false)
  })

  it('faceLuminance が未指定/NaN だと light が落ちる', () => {
    expect(keyOf(checkQuality({ ...good, faceLuminance: undefined }), 'light').ok).toBe(false)
    expect(keyOf(checkQuality({ ...good, faceLuminance: NaN }), 'light').ok).toBe(false)
  })

  it('motion が未指定/NaN だと still が落ちる', () => {
    expect(keyOf(checkQuality({ ...good, motion: undefined }), 'still').ok).toBe(false)
    expect(keyOf(checkQuality({ ...good, motion: NaN }), 'still').ok).toBe(false)
  })

  it('offAxisDeg が負の値で閾値を超えても落ちる', () => {
    const r = checkQuality({ ...good, offAxisDeg: -40 })
    expect(r.ok).toBe(false)
    expect(keyOf(r, 'direction').ok).toBe(false)
  })

  it('THRESHOLDS は凍結されていて書き換えられない', () => {
    const before = THRESHOLDS.offAxisDeg
    expect(() => {
      THRESHOLDS.offAxisDeg = 999
    }).toThrow()
    expect(THRESHOLDS.offAxisDeg).toBe(before)
  })
})
