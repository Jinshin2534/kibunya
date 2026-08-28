import { describe, it, expect } from 'vitest'
import { isValidDump, sortByDate, parseDumpJson } from '../src/lib/dump.js'

describe('isValidDump', () => {
  it('正常なダンプは true', () => {
    const dump = {
      version: 1,
      baseline: { id: 'current', features: {} },
      entries: [{ date: '2026-01-01' }, { date: '2026-01-02' }],
      settings: { keepThumbnails: true },
    }
    expect(isValidDump(dump)).toBe(true)
  })

  it('entries が空配列でも true', () => {
    expect(isValidDump({ entries: [] })).toBe(true)
  })

  it('baseline が無くても true', () => {
    expect(isValidDump({ entries: [] })).toBe(true)
  })

  it('baseline が null でも true', () => {
    expect(isValidDump({ entries: [], baseline: null })).toBe(true)
  })

  it('settings が無くても true', () => {
    expect(isValidDump({ entries: [] })).toBe(true)
  })

  it('settings が null でも true', () => {
    expect(isValidDump({ entries: [], settings: null })).toBe(true)
  })

  describe('dump 自体が不正', () => {
    it('null は false', () => {
      expect(isValidDump(null)).toBe(false)
    })
    it('undefined は false', () => {
      expect(isValidDump(undefined)).toBe(false)
    })
    it('配列は false', () => {
      expect(isValidDump([{ entries: [] }])).toBe(false)
    })
    it('文字列は false', () => {
      expect(isValidDump('{"entries":[]}')).toBe(false)
    })
  })

  describe('entries が不正', () => {
    it('entries が配列でない（オブジェクト）と false', () => {
      expect(isValidDump({ entries: {} })).toBe(false)
    })
    it('entries が無いと false', () => {
      expect(isValidDump({})).toBe(false)
    })
    it('要素がオブジェクトでない（文字列）と false', () => {
      expect(isValidDump({ entries: ['2026-01-01'] })).toBe(false)
    })
    it('要素が配列だと false（配列はプレーンオブジェクト扱いしない）', () => {
      expect(isValidDump({ entries: [['2026-01-01']] })).toBe(false)
    })
    it('要素の date が無いと false', () => {
      expect(isValidDump({ entries: [{ capturedAt: 0 }] })).toBe(false)
    })
    it('要素の date が文字列でない（数値）と false', () => {
      expect(isValidDump({ entries: [{ date: 20260101 }] })).toBe(false)
    })
    it('要素の date の形式が不正（区切り違い）だと false', () => {
      expect(isValidDump({ entries: [{ date: '2026/01/01' }] })).toBe(false)
    })
    it('要素の date の形式が不正（桁不足）だと false', () => {
      expect(isValidDump({ entries: [{ date: '2026-1-1' }] })).toBe(false)
    })
    it('複数要素のうち1つでも不正なら false', () => {
      expect(isValidDump({ entries: [{ date: '2026-01-01' }, { date: 'bad' }] })).toBe(false)
    })
  })

  describe('baseline が不正', () => {
    it('文字列だと false', () => {
      expect(isValidDump({ entries: [], baseline: 'current' })).toBe(false)
    })
    it('数値だと false', () => {
      expect(isValidDump({ entries: [], baseline: 1 })).toBe(false)
    })
    it('配列だと false', () => {
      expect(isValidDump({ entries: [], baseline: [] })).toBe(false)
    })
  })

  describe('settings が不正', () => {
    it('配列だと false', () => {
      expect(isValidDump({ entries: [], settings: [] })).toBe(false)
    })
  })
})

describe('sortByDate', () => {
  it('既にソート済みならそのままの順序', () => {
    const rows = [{ date: '2026-01-01' }, { date: '2026-01-02' }, { date: '2026-01-03' }]
    expect(sortByDate(rows).map((r) => r.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('逆順を昇順に並べ替える', () => {
    const rows = [{ date: '2026-03-01' }, { date: '2026-02-01' }, { date: '2026-01-01' }]
    expect(sortByDate(rows).map((r) => r.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  it('混在した順序を昇順に並べ替える', () => {
    const rows = [
      { date: '2026-02-15' },
      { date: '2026-01-01' },
      { date: '2026-03-01' },
      { date: '2026-01-31' },
    ]
    expect(sortByDate(rows).map((r) => r.date)).toEqual([
      '2026-01-01',
      '2026-01-31',
      '2026-02-15',
      '2026-03-01',
    ])
  })

  it('引数の配列そのものは変更しない（新しい配列を返す）', () => {
    const rows = [{ date: '2026-03-01' }, { date: '2026-01-01' }]
    const original = [...rows]
    const result = sortByDate(rows)
    expect(rows).toEqual(original)
    expect(result).not.toBe(rows)
  })
})

describe('parseDumpJson', () => {
  it('妥当な JSON をパースしたオブジェクトを返す', () => {
    expect(parseDumpJson('{"entries":[{"date":"2026-01-01"}]}')).toEqual({
      entries: [{ date: '2026-01-01' }],
    })
  })

  it('配列やプリミティブの JSON もそのまま返す（妥当性の判定は isValidDump の役目）', () => {
    expect(parseDumpJson('[1,2,3]')).toEqual([1, 2, 3])
    expect(parseDumpJson('null')).toBe(null)
    expect(parseDumpJson('42')).toBe(42)
  })

  it('壊れた JSON は日本語のメッセージで投げる', () => {
    expect(() => parseDumpJson('{not valid json')).toThrow('JSON として読み取れないファイルです')
  })

  it('空文字列も壊れた JSON として扱う', () => {
    expect(() => parseDumpJson('')).toThrow('JSON として読み取れないファイルです')
  })

  it('元の SyntaxError のメッセージ（英語）は外に漏らさない', () => {
    try {
      parseDumpJson('<html>not json</html>')
      throw new Error('ここには来ないはず')
    } catch (err) {
      expect(err.message).toBe('JSON として読み取れないファイルです')
      expect(err.message).not.toMatch(/Unexpected|JSON\.parse/)
    }
  })
})
