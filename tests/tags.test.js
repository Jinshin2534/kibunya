import { describe, it, expect } from 'vitest'
import { tagStats } from '../src/lib/tags.js'
import { FEATURE_NAMES } from '../src/lib/features.js'

function entry(date, tags, eyeOpenL) {
  const z = Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0]))
  z.eyeOpenL = eyeOpenL
  return { date, z, labels: { tags } }
}

describe('tagStats', () => {
  const entries = [
    entry('2026-01-01', ['寝不足'], -1.5),
    entry('2026-01-02', ['寝不足'], -1.3),
    entry('2026-01-03', ['寝不足'], -1.1),
    entry('2026-01-04', [], 0.4),
    entry('2026-01-05', [], 0.6),
    entry('2026-01-06', ['むくみ'], 0.5),
  ]

  it('件数が足りるタグだけ返す', () => {
    const r = tagStats(entries, 3)
    expect(r.map((t) => t.tag)).toEqual(['寝不足'])
    expect(r[0].count).toBe(3)
  })

  it('差が大きい特徴量を上位に出し、符号が正しい', () => {
    const top = tagStats(entries, 3)[0].features[0]
    expect(top.feature).toBe('eyeOpenL')
    expect(top.label).toBe('左目の開き')
    expect(top.delta).toBeLessThan(0) // 寝不足の日は目の開きが小さい
  })

  it('上位 3 本まで', () => {
    expect(tagStats(entries, 3)[0].features.length).toBeLessThanOrEqual(3)
  })

  it('件数の多い順に並ぶ', () => {
    const many = [...entries, entry('2026-01-07', ['むくみ'], 0.5), entry('2026-01-08', ['むくみ'], 0.5),
                  entry('2026-01-09', ['むくみ'], 0.5), entry('2026-01-10', ['むくみ'], 0.5)]
    expect(tagStats(many, 3)[0].tag).toBe('むくみ')
  })

  it('タグが無ければ空', () => {
    expect(tagStats([entry('2026-01-01', [], 0)], 3)).toEqual([])
  })

  // 追加の防御テスト
  it('すべてのエントリがタグを持つとき除外される', () => {
    const allTagged = [
      entry('2026-01-01', ['同じ'], 1),
      entry('2026-01-02', ['同じ'], 1),
      entry('2026-01-03', ['同じ'], 1),
    ]
    const r = tagStats(allTagged, 3)
    expect(r).toEqual([])
  })

  it('entry に labels がない場合も処理できる', () => {
    const withoutLabels = [
      { date: '2026-01-01', z: Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0])) },
      entry('2026-01-02', ['tag'], 1),
      entry('2026-01-03', ['tag'], 1),
      entry('2026-01-04', ['tag'], 1),
    ]
    const r = tagStats(withoutLabels, 3)
    expect(r.length).toBe(1)
    expect(r[0].tag).toBe('tag')
  })

  it('entry.labels.tags が undefined の場合も処理できる', () => {
    const withoutTags = [
      { date: '2026-01-01', z: Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0])), labels: {} },
      entry('2026-01-02', ['tag'], 1),
      entry('2026-01-03', ['tag'], 1),
      entry('2026-01-04', ['tag'], 1),
    ]
    const r = tagStats(withoutTags, 3)
    expect(r.length).toBe(1)
    expect(r[0].tag).toBe('tag')
  })

  it('等件数のタグは先に見られた順で返し、より多い件数のタグが先に来る', () => {
    const mixed = [
      entry('2026-01-01', ['alpha'], 0),
      entry('2026-01-02', ['alpha'], 0),
      entry('2026-01-03', ['alpha'], 0),
      entry('2026-01-04', ['beta'], 0),
      entry('2026-01-05', ['beta'], 0),
      entry('2026-01-06', ['beta'], 0),
      entry('2026-01-07', ['gamma'], 0),  // count=1 < 3、フィルタ対象外
      entry('2026-01-08', ['delta'], 0),
      entry('2026-01-09', ['delta'], 0),
      entry('2026-01-10', ['delta'], 0),
      entry('2026-01-11', ['delta'], 0),  // count=4 > 3、先に来る
    ]
    const r = tagStats(mixed, 3)
    // deltaがcount=4なので最初
    expect(r[0].tag).toBe('delta')
    expect(r[0].count).toBe(4)
    // alphaとbetaは等count=3だが、alphaが先に見られたので先に来る（Mapの順序）
    expect(r[1].tag).toBe('alpha')
    expect(r[1].count).toBe(3)
    expect(r[2].tag).toBe('beta')
    expect(r[2].count).toBe(3)
  })

  it('デルタが正確に 0 でも計算できる', () => {
    const zeroCorr = [
      entry('2026-01-01', ['tag'], 1),
      entry('2026-01-02', ['tag'], 1),
      entry('2026-01-03', ['tag'], 1),
      entry('2026-01-04', [], 1),
      entry('2026-01-05', [], 1),
    ]
    const r = tagStats(zeroCorr, 3)
    expect(r.length).toBe(1)
    expect(r[0].features[0].delta).toBeCloseTo(0, 9)
  })

  it('複数タグを持つエントリは各タグに計算される', () => {
    const multiTag = [
      entry('2026-01-01', ['tag1', 'tag2'], 1),
      entry('2026-01-02', ['tag1'], 0),
      entry('2026-01-03', ['tag2'], 0),
      entry('2026-01-04', [], 0),
      entry('2026-01-05', [], 0),
      entry('2026-01-06', [], 0),
    ]
    const r = tagStats(multiTag, 1)
    expect(r.some((t) => t.tag === 'tag1')).toBe(true)
    expect(r.some((t) => t.tag === 'tag2')).toBe(true)
  })
})
