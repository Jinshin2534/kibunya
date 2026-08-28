import { describe, it, expect } from 'vitest'
import { TARGETS, TARGET_KEYS, DEFAULT_TAGS, emptyLabels, normalizeLabels, SCALE_MIN, SCALE_MAX } from '../src/lib/labels.js'
import { dateKey, addDays } from '../src/lib/dates.js'

describe('TARGETS', () => {
  it('3つ、順番は 体調・気分・眠さ', () => {
    expect(TARGET_KEYS).toEqual(['condition', 'mood', 'sleepiness'])
    expect(TARGETS.map((t) => t.label)).toEqual(['体調', '気分', '眠さ'])
  })
  it('両端に日本語のラベルがある', () => {
    for (const t of TARGETS) {
      expect(t.low.length).toBeGreaterThan(0)
      expect(t.high.length).toBeGreaterThan(0)
    }
  })
  it('既定タグが用意されている', () => {
    expect(DEFAULT_TAGS).toContain('寝不足')
    expect(DEFAULT_TAGS.length).toBeGreaterThanOrEqual(8)
  })
})

describe('emptyLabels', () => {
  it('まん中の 3 とタグ無しで始まる', () => {
    expect(emptyLabels()).toEqual({ condition: 3, mood: 3, sleepiness: 3, tags: [] })
  })
})

describe('normalizeLabels', () => {
  it('範囲外は端に丸める', () => {
    const n = normalizeLabels({ condition: 99, mood: -4, sleepiness: 3 })
    expect(n.condition).toBe(SCALE_MAX)
    expect(n.mood).toBe(SCALE_MIN)
  })
  it('小数は整数に丸める', () => {
    expect(normalizeLabels({ condition: 3.7 }).condition).toBe(4)
  })
  it('数値でなければ 3', () => {
    expect(normalizeLabels({ condition: 'よい' }).condition).toBe(3)
    expect(normalizeLabels(null).mood).toBe(3)
  })
  it('タグは trim・空除去・重複除去する', () => {
    expect(normalizeLabels({ tags: [' 寝不足 ', '寝不足', '', '  ', 'むくみ'] }).tags)
      .toEqual(['寝不足', 'むくみ'])
  })
  it('タグが配列でなければ空配列', () => {
    expect(normalizeLabels({ tags: '寝不足' }).tags).toEqual([])
  })
})

describe('dateKey / addDays', () => {
  it('ローカル時刻で YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 7, 29, 23, 30))).toBe('2026-08-29')
  })
  it('1桁は 0 埋めする', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('日付を足す', () => {
    expect(dateKey(addDays(new Date(2026, 7, 31), 1))).toBe('2026-09-01')
  })
  it('日付を引く', () => {
    expect(dateKey(addDays(new Date(2026, 8, 1), -1))).toBe('2026-08-31')
  })
})

describe('Guard tests: normalizeLabels', () => {
  it('NaN を数値として処理して 3 になる', () => {
    expect(normalizeLabels({ condition: NaN }).condition).toBe(3)
  })
  it('Infinity を数値として処理して 3 になる', () => {
    expect(normalizeLabels({ mood: Infinity }).mood).toBe(3)
  })
  it('-Infinity を数値として処理して 3 になる', () => {
    expect(normalizeLabels({ sleepiness: -Infinity }).sleepiness).toBe(3)
  })
  it('boolean は非数値として 3 になる', () => {
    expect(normalizeLabels({ condition: true }).condition).toBe(3)
    expect(normalizeLabels({ mood: false }).mood).toBe(3)
  })
  it('数値文字列 "4" は非数値として 3 になる', () => {
    expect(normalizeLabels({ sleepiness: '4' }).sleepiness).toBe(3)
  })
  it('小数 3.5 は 4 に丸める（banker\'s rounding ではなく .5 で上）', () => {
    expect(normalizeLabels({ condition: 3.5 }).condition).toBe(4)
    expect(normalizeLabels({ mood: 2.5 }).mood).toBe(3)
  })
  it('小数 1.4 は 1 に丸める', () => {
    expect(normalizeLabels({ sleepiness: 1.4 }).sleepiness).toBe(1)
  })
  it('オブジェクトの未知キーは結果に含まれない', () => {
    const result = normalizeLabels({ condition: 3, unknown: 'field', extra: 123 })
    expect(Object.keys(result)).toEqual(['condition', 'mood', 'sleepiness', 'tags'])
  })
  it('tags 配列内の数値は文字列に変換される', () => {
    expect(normalizeLabels({ tags: [1, 2, '三'] }).tags).toEqual(['1', '2', '三'])
  })
  it('tags 配列内の null は "null" という文字列になる', () => {
    expect(normalizeLabels({ tags: [null, 'むくみ'] }).tags).toEqual(['null', 'むくみ'])
  })
  it('tags 配列内のオブジェクトは [object Object] になり trim される', () => {
    const result = normalizeLabels({ tags: [{}, 'むくみ'] })
    expect(result.tags).toContain('むくみ')
    expect(result.tags).toContain('[object Object]')
  })
  it('whitespace のみの tag は除去される', () => {
    expect(normalizeLabels({ tags: ['  \t\n  ', '寝不足'] }).tags).toEqual(['寝不足'])
  })
  it('leading/trailing whitespace だけ異なるタグは重複除去される', () => {
    expect(normalizeLabels({ tags: ['寝不足', ' 寝不足 ', '  寝不足  '] }).tags).toEqual(['寝不足'])
  })
})

describe('Guard tests: emptyLabels', () => {
  it('emptyLabels() は毎回新しいオブジェクトを返す（参照共有されない）', () => {
    const a = emptyLabels()
    const b = emptyLabels()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
  it('emptyLabels() の tags は毎回新しい配列を返す', () => {
    const a = emptyLabels()
    const b = emptyLabels()
    expect(a.tags).not.toBe(b.tags)
  })
})

describe('Guard tests: addDays', () => {
  it('addDays(d, 0) は同じ日付を返す', () => {
    const d = new Date(2026, 7, 15, 12, 30, 45)
    const result = addDays(d, 0)
    expect(dateKey(result)).toBe(dateKey(d))
  })
  it('addDays は元の日付を変更しない（イミュータブル）', () => {
    const d = new Date(2026, 7, 15)
    const original = dateKey(d)
    addDays(d, 5)
    expect(dateKey(d)).toBe(original)
  })
  it('年をまたぐ addDays: 12月31日 + 1 = 1月1日（翌年）', () => {
    const d = new Date(2026, 11, 31)
    const result = addDays(d, 1)
    expect(dateKey(result)).toBe('2027-01-01')
  })
  it('年をまたぐ addDays: 1月1日 - 1 = 12月31日（前年）', () => {
    const d = new Date(2026, 0, 1)
    const result = addDays(d, -1)
    expect(dateKey(result)).toBe('2025-12-31')
  })
})

describe('Guard tests: dateKey', () => {
  it('12月の日付は正しくフォーマットされる', () => {
    expect(dateKey(new Date(2026, 11, 15))).toBe('2026-12-15')
    expect(dateKey(new Date(2026, 11, 1))).toBe('2026-12-01')
  })
  it('1月の日付は正しくフォーマットされる', () => {
    expect(dateKey(new Date(2026, 0, 31))).toBe('2026-01-31')
  })
})
