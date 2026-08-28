import { describe, it, expect } from 'vitest'
import { makeRng, syntheticDay } from '../src/lib/synthetic.js'
import { FEATURE_NAMES } from '../src/lib/features.js'

function fromSequence(values) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('makeRng', () => {
  it('同じ seed なら同じ数列', () => {
    const a = makeRng(1)
    const b = makeRng(1)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('違う seed なら違う数列になる', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)())
  })

  it('[0, 1) の範囲に収まる', () => {
    const r = makeRng(42)
    for (let i = 0; i < 200; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('syntheticDay', () => {
  it('全特徴量が z に入り、範囲は [-1, 1)', () => {
    const r = makeRng(7)
    const { z } = syntheticDay(r)
    expect(Object.keys(z).sort()).toEqual([...FEATURE_NAMES].sort())
    for (const k of FEATURE_NAMES) {
      expect(z[k]).toBeGreaterThanOrEqual(-1)
      expect(z[k]).toBeLessThan(1)
    }
  })

  it('ラベル（体調・気分・眠さ）は 1〜5 の整数', () => {
    const r = makeRng(7)
    for (let i = 0; i < 100; i++) {
      const { labels } = syntheticDay(r)
      for (const key of ['condition', 'mood', 'sleepiness']) {
        expect(Number.isInteger(labels[key])).toBe(true)
        expect(labels[key]).toBeGreaterThanOrEqual(1)
        expect(labels[key]).toBeLessThanOrEqual(5)
      }
    }
  })

  it('tags は「寝不足」のみで、確率はおよそ3割', () => {
    const r = makeRng(123)
    let flagged = 0
    const total = 3000
    for (let i = 0; i < total; i++) {
      const { labels } = syntheticDay(r)
      expect(Array.isArray(labels.tags)).toBe(true)
      if (labels.tags.length) {
        expect(labels.tags).toEqual(['寝不足'])
        flagged++
      }
    }
    const rate = flagged / total
    expect(rate).toBeGreaterThan(0.25)
    expect(rate).toBeLessThan(0.35)
  })

  it('体調は eyeOpenL が高い日ほど良くなる（正の相関）', () => {
    const r = makeRng(99)
    const rows = Array.from({ length: 400 }, () => syntheticDay(r))
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length
    const hi = avg(rows.filter((d) => d.z.eyeOpenL > 0.5).map((d) => d.labels.condition))
    const lo = avg(rows.filter((d) => d.z.eyeOpenL < -0.5).map((d) => d.labels.condition))
    expect(hi).toBeGreaterThan(lo)
  })

  it('眠さは eyeOpenR が高い日ほど下がる（負の相関）', () => {
    const r = makeRng(99)
    const rows = Array.from({ length: 400 }, () => syntheticDay(r))
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length
    const hi = avg(rows.filter((d) => d.z.eyeOpenR > 0.5).map((d) => d.labels.sleepiness))
    const lo = avg(rows.filter((d) => d.z.eyeOpenR < -0.5).map((d) => d.labels.sleepiness))
    expect(hi).toBeLessThan(lo)
  })

  it('気分は z（顔）と無関係：同じ z でも mood 用の乱数だけ変えれば結果だけ変わる', () => {
    // 最初の15回（FEATURE_NAMES の数）で z を作り、続く4回が condition/mood/sleepiness/tags の
    // ノイズに使われる。z 用と condition/sleepiness/tags 用の乱数を揃え、mood 用だけ変える。
    const zSeq = Array.from({ length: FEATURE_NAMES.length }, (_, i) => (i % 5) / 5)
    const seqA = fromSequence([...zSeq, 0.1, 0.9, 0.1, 0.1])
    const seqB = fromSequence([...zSeq, 0.1, 0.1, 0.1, 0.1])
    const a = syntheticDay(seqA)
    const b = syntheticDay(seqB)
    expect(a.z).toEqual(b.z)
    expect(a.labels.condition).toBe(b.labels.condition)
    expect(a.labels.sleepiness).toBe(b.labels.sleepiness)
    expect(a.labels.mood).not.toBe(b.labels.mood)
  })

  it('気分は eyeOpenL/eyeOpenR/underEyeDark などの顔の特徴と無相関である', () => {
    // 多数の行を生成し、顔の特徴ごとに高い/低いで気分の平均を分割。
    // 相関があれば高い側と低い側で気分の平均が異なるはず。
    // 相関がなければ、平均は同程度。
    const r = makeRng(42)
    const rows = Array.from({ length: 500 }, () => syntheticDay(r))
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length

    // 複数の顔特徴について、高い/低いで気分の平均を比較
    const featuresToTest = ['eyeOpenL', 'eyeOpenR', 'underEyeDark']
    for (const feature of featuresToTest) {
      const hi = avg(rows.filter((d) => d.z[feature] > 0.5).map((d) => d.labels.mood))
      const lo = avg(rows.filter((d) => d.z[feature] < -0.5).map((d) => d.labels.mood))
      const diff = Math.abs(hi - lo)
      // 相関がなければ、平均差は小さい。実測から判定閾値を設定。
      // 気分は 1-5 の1-5スケール。無相関なら平均差は 0.5 以下が妥当。
      expect(diff).toBeLessThan(0.5)
    }
  })
})
