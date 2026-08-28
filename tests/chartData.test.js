import { describe, it, expect } from 'vitest'
import { normalize, polylinePoints, describeCorrelation } from '../src/lib/chartData.js'

describe('normalize', () => {
  it('最小を0、最大を1にする', () => {
    expect(normalize([1, 2, 3])).toEqual([0, 0.5, 1])
  })

  it('全部同じ値なら0.5の直線', () => {
    expect(normalize([5, 5, 5])).toEqual([0.5, 0.5, 0.5])
  })

  it('要素が1つでも0.5になる（min===maxのため）', () => {
    expect(normalize([7])).toEqual([0.5])
  })

  it('空配列は空配列', () => {
    expect(normalize([])).toEqual([])
  })

  it('NaNが混じっても出力にNaNを出さない（0として扱う）', () => {
    const r = normalize([1, NaN, 3])
    expect(r.every((v) => Number.isFinite(v))).toBe(true)
    // NaN は 0 として扱われるので、範囲は [0, 3] になり NaN は (0-0)/(3-0) = 0
    expect(r).toEqual([1 / 3, 0, 1])
  })

  it('Infinityが混じっても出力にNaN/Infinityを出さない（0として扱う）', () => {
    const r = normalize([1, Infinity, -Infinity, 3])
    expect(r.every((v) => Number.isFinite(v))).toBe(true)
  })

  it('全部非有限なら全部0扱いになり0.5の直線', () => {
    expect(normalize([NaN, Infinity, -Infinity])).toEqual([0.5, 0.5, 0.5])
  })

  it('負の値も正しく正規化する', () => {
    expect(normalize([-10, 0, 10])).toEqual([0, 0.5, 1])
  })
})

describe('polylinePoints', () => {
  it('通常の3点を width/height に合わせた座標文字列にする', () => {
    const r = polylinePoints([0, 0.5, 1], 3, 300, 90)
    expect(r).toBe('0.0,90.0 150.0,45.0 300.0,0.0')
  })

  it('2点だけでも描ける', () => {
    const r = polylinePoints([0, 1], 2, 100, 100)
    expect(r).toBe('0.0,100.0 100.0,0.0')
  })

  it('n が 1（点が1つ）なら空文字を返す（ゼロ除算を避ける）', () => {
    expect(polylinePoints([0.5], 1, 100, 100)).toBe('')
  })

  it('n が 0 なら空文字を返す', () => {
    expect(polylinePoints([], 0, 100, 100)).toBe('')
  })

  it('n が非有限（NaN）なら空文字を返す', () => {
    expect(polylinePoints([0.5, 0.6], NaN, 100, 100)).toBe('')
  })

  it('値がNaNでもNaNを含む文字列を作らない（0にクランプ）', () => {
    const r = polylinePoints([0, NaN, 1], 3, 300, 90)
    expect(r).not.toMatch(/NaN/)
    expect(r).toBe('0.0,90.0 150.0,90.0 300.0,0.0')
  })

  it('0〜1の範囲外の値もクランプする', () => {
    const r = polylinePoints([-5, 0.5, 5], 3, 300, 90)
    expect(r).toBe('0.0,90.0 150.0,45.0 300.0,0.0')
  })

  it('系列が n より短くても（他系列の方が長くても）NaNを出さず、その分だけ点を作る', () => {
    // linesSvg は series 間で最長の長さを n として共有して渡す。
    // 短い系列は x が 0 から詰まった点しか持たない。
    const r = polylinePoints([0, 1], 4, 300, 90)
    expect(r).toBe('0.0,90.0 100.0,0.0')
    expect(r).not.toMatch(/NaN/)
  })
})

describe('describeCorrelation', () => {
  it('完全に正の相関なら r は1に近く、「同じ向き」「強く」と言う', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])
    expect(r).toBeCloseTo(1, 9)
    expect(text).toContain('同じ向き')
    expect(text).toContain('強く')
    expect(text).toBe('相関 ＋1.00 — 同じ向きに強く一緒に動いています')
  })

  it('完全に負の相関なら r は−1に近く、「逆の向き」と言う（Math.abs を忘れると壊れる境界）', () => {
    // v=-1 を符号なしで強さ判定に使うと m=-1 になり、どの閾値(>=0.2 等)も
    // 満たさず「関係は見えません」に落ちてしまう。Math.abs が要る所以。
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])
    expect(r).toBeCloseTo(-1, 9)
    expect(text).toContain('逆の向き')
    expect(text).toContain('強く')
    expect(text).toBe('相関 −1.00 — 逆の向きに強く一緒に動いています')
  })

  it('無相関（r=0）なら「関係は見えません」で、向きの言葉を含まない', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [1, 5, 4, 3, 2])
    expect(r).toBeCloseTo(0, 9)
    expect(text).toContain('関係は見えません')
    expect(text).not.toContain('同じ向き')
    expect(text).not.toContain('逆の向き')
  })

  it('強さの境界 0.7：ちょうど0.7は「強く」', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [1, 2, 4, 5, 3])
    expect(r).toBeCloseTo(0.7, 9)
    expect(text).toContain('強く一緒に動いています')
  })

  it('強さの境界 0.7：すぐ下（≈0.657）は「そこそこ」', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5, 6], [1, 2, 4, 5, 6, 3])
    expect(r).toBeCloseTo(0.657143, 5)
    expect(text).toContain('そこそこ一緒に動いています')
  })

  it('強さの境界 0.4：ちょうど0.4は「そこそこ」', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [1, 3, 4, 5, 2])
    expect(r).toBeCloseTo(0.4, 9)
    expect(text).toContain('そこそこ一緒に動いています')
  })

  it('強さの境界 0.4：すぐ下（≈0.371）は「わずか」', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5, 6], [1, 3, 4, 6, 5, 2])
    expect(r).toBeCloseTo(0.371429, 5)
    expect(text).toContain('わずかに関係がありそうです')
  })

  it('強さの境界 0.2：ちょうど0.2は「わずか」', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [1, 4, 5, 2, 3])
    expect(r).toBeCloseTo(0.2, 9)
    expect(text).toContain('わずかに関係がありそうです')
  })

  it('強さの境界 0.2：すぐ下（≈0.143）は「関係は見えません」', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5, 6], [1, 4, 5, 6, 2, 3])
    expect(r).toBeCloseTo(0.142857, 5)
    expect(text).toContain('関係は見えません')
    expect(text).not.toContain('同じ向き')
  })

  it('片方が定数なら「関係は見えません」で、NaNを含まない', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [7, 7, 7, 7, 7])
    expect(r).toBe(0)
    expect(text).not.toMatch(/NaN/)
    expect(text).toContain('関係は見えません')
  })

  it('0の符号は−ではなく＋になる', () => {
    const { text } = describeCorrelation([1, 2, 3, 4, 5], [7, 7, 7, 7, 7])
    expect(text.startsWith('相関 ＋0.00')).toBe(true)
  })

  it('空配列同士でもNaN/undefinedを出さない', () => {
    const { r, text } = describeCorrelation([], [])
    expect(Number.isFinite(r)).toBe(true)
    expect(text).not.toMatch(/NaN|undefined/)
  })

  it('長さが違う配列でもNaN/undefinedを出さない（短い方に合わせる）', () => {
    const { r, text } = describeCorrelation([1, 2, 3, 4, 5], [1, 2, 4])
    expect(Number.isFinite(r)).toBe(true)
    expect(text).not.toMatch(/NaN|undefined/)
  })

  it('非有限値（NaN・Infinity）が混じってもNaN/undefinedを出さない', () => {
    const a = describeCorrelation([1, 2, NaN, 4, 5], [1, 2, 3, 4, 5])
    expect(Number.isFinite(a.r)).toBe(true)
    expect(a.text).not.toMatch(/NaN|undefined/)

    const b = describeCorrelation([1, 2, Infinity, 4, 5], [1, 2, 3, 4, 5])
    expect(Number.isFinite(b.r)).toBe(true)
    expect(b.text).not.toMatch(/NaN|undefined/)
  })
})
