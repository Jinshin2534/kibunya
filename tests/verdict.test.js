import { describe, it, expect } from 'vitest'
import {
  HIT_TOLERANCE, readableTargets, unreadableTargets, scaleToPercent, judgeEntry,
} from '../src/lib/verdict.js'
import { TARGET_KEYS } from '../src/lib/labels.js'

const allValues = (v) => ({ condition: v, mood: v, sleepiness: v })

describe('readableTargets', () => {
  it('すべて数値なら 3 つとも返す', () => {
    const out = readableTargets({ values: allValues(3) })
    expect(out.map((t) => t.key)).toEqual(TARGET_KEYS)
  })
  it('NaN の的は除く', () => {
    const out = readableTargets({ values: { condition: 3, mood: NaN, sleepiness: 2 } })
    expect(out.map((t) => t.key)).toEqual(['condition', 'sleepiness'])
  })
  it('prediction が無くても落ちない（空配列）', () => {
    expect(readableTargets(null)).toEqual([])
    expect(readableTargets(undefined)).toEqual([])
  })
})

describe('unreadableTargets', () => {
  it('readableTargets の補集合になる', () => {
    const prediction = { values: { condition: 3, mood: NaN, sleepiness: undefined } }
    expect(readableTargets(prediction).map((t) => t.key)).toEqual(['condition'])
    expect(unreadableTargets(prediction).map((t) => t.key)).toEqual(['mood', 'sleepiness'])
  })
  it('すべて読めなければ全件', () => {
    const out = unreadableTargets({ values: {} })
    expect(out.map((t) => t.key)).toEqual(TARGET_KEYS)
  })
  it('すべて読めれば空', () => {
    expect(unreadableTargets({ values: allValues(1) })).toEqual([])
  })
})

describe('scaleToPercent', () => {
  it('最小値は 0%、最大値は 100%', () => {
    expect(scaleToPercent(1)).toBe(0)
    expect(scaleToPercent(5)).toBe(100)
  })
  it('まん中の 3 は 50%', () => {
    expect(scaleToPercent(3)).toBe(50)
  })
  it('範囲外もそのまま外挿する（呼び出し側の責務）', () => {
    expect(scaleToPercent(6)).toBe(125)
    expect(scaleToPercent(0)).toBe(-25)
  })
})

describe('judgeEntry', () => {
  it('ズレが HIT_TOLERANCE 以内なら当たり', () => {
    const prediction = { values: { condition: 3, mood: 4, sleepiness: 2 } }
    const labels = { condition: 3, mood: 5, sleepiness: 2, tags: [] }
    const out = judgeEntry(prediction, labels)
    expect(out.find((j) => j.key === 'condition').hit).toBe(true)
    expect(out.find((j) => j.key === 'mood').hit).toBe(true) // diff = 1 ちょうど
    expect(out.find((j) => j.key === 'sleepiness').hit).toBe(true)
  })
  it('ズレが HIT_TOLERANCE を超えるとはずれ', () => {
    const prediction = { values: { condition: 1, mood: 3, sleepiness: 3 } }
    const labels = { condition: 5, mood: 3, sleepiness: 5, tags: [] }
    const out = judgeEntry(prediction, labels)
    expect(out.find((j) => j.key === 'condition').hit).toBe(false)
    expect(out.find((j) => j.key === 'sleepiness').hit).toBe(false)
    expect(out.find((j) => j.key === 'mood').hit).toBe(true)
  })
  it('読み取れなかった的は判定に含めない', () => {
    const prediction = { values: { condition: 3, mood: NaN, sleepiness: 3 } }
    const labels = { condition: 3, mood: 1, sleepiness: 3, tags: [] }
    const out = judgeEntry(prediction, labels)
    expect(out.map((j) => j.key)).toEqual(['condition', 'sleepiness'])
  })
  it('HIT_TOLERANCE は 1', () => {
    expect(HIT_TOLERANCE).toBe(1)
  })
})
