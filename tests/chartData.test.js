import { describe, it, expect } from 'vitest'
import { normalize, polylinePoints } from '../src/lib/chartData.js'

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
