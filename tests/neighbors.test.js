import { describe, it, expect } from 'vitest'
import { similarDays } from '../src/lib/neighbors.js'
import { FEATURE_NAMES } from '../src/lib/features.js'

const z = (v) => Object.fromEntries(FEATURE_NAMES.map((n) => [n, v]))
const entries = [
  { date: '2026-01-01', z: z(0) },
  { date: '2026-01-02', z: z(1) },
  { date: '2026-01-03', z: z(3) },
  { date: '2026-01-04', z: z(-2) },
]

describe('similarDays', () => {
  it('近い順に返す', () => {
    const r = similarDays(z(0.9), entries, 2)
    expect(r.map((x) => x.entry.date)).toEqual(['2026-01-02', '2026-01-01'])
  })
  it('距離も返す', () => {
    expect(similarDays(z(1), entries, 1)[0].distance).toBeCloseTo(0, 9)
  })
  it('k 件まで', () => {
    expect(similarDays(z(0), entries, 3)).toHaveLength(3)
  })
  it('自分自身は除外できる', () => {
    const r = similarDays(z(1), entries, 1, '2026-01-02')
    expect(r[0].entry.date).not.toBe('2026-01-02')
  })
  it('記録が無ければ空', () => {
    expect(similarDays(z(0), [], 3)).toEqual([])
  })

  // 追加の防御テスト
  it('k が件数より大きければすべて返す', () => {
    const r = similarDays(z(0), entries, 100)
    expect(r.length).toBe(4)
  })

  it('k が 0 なら空を返す', () => {
    const r = similarDays(z(0), entries, 0)
    expect(r).toEqual([])
  })

  it('k が負なら空を返す', () => {
    const r = similarDays(z(0), entries, -1)
    expect(r).toEqual([])
  })

  it('k が NaN なら空を返す', () => {
    const r = similarDays(z(0), entries, NaN)
    expect(r).toEqual([])
  })

  it('z が完全に欠けていてもtoVectorで0に埋まる', () => {
    const r = similarDays({}, entries, 2)
    expect(r.length).toBe(2)
    expect(r[0].distance).toBeDefined()
  })

  it('等距離エントリは挿入順を保ち、より遠いエントリは後ろに来る', () => {
    const mixed = [
      { date: 'a', z: z(0) },      // distance 0.5
      { date: 'b', z: z(0) },      // distance 0.5
      { date: 'far', z: z(10) },   // distance >> 0.5（ターゲット 0.1 に対して）
    ]
    const r = similarDays(z(0.1), mixed, 3)
    const dates = r.map((x) => x.entry.date)
    // 等距離の a, b が先に来て挿入順を保つ
    expect(dates.slice(0, 2)).toEqual(['a', 'b'])
    // 遠い far が最後
    expect(dates[2]).toBe('far')
  })

  it('excludeDate が存在しないとき全件対象', () => {
    const r = similarDays(z(0), entries, 4, 'nonexistent')
    expect(r.length).toBe(4)
  })

  it('excludeDate で指定した日を除外する', () => {
    const r = similarDays(z(0), entries, 10, '2026-01-01')
    const dates = r.map((x) => x.entry.date)
    expect(dates).not.toContain('2026-01-01')
    expect(r.length).toBe(3) // 4件中1件除外
  })

  it('単一エントリだけの場合、そのエントリが除外されると空を返す', () => {
    const single = [{ date: '2026-01-01', z: z(0) }]
    const r = similarDays(z(0), single, 10, '2026-01-01')
    expect(r).toEqual([])
  })
})
