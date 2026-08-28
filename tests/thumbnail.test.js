import { describe, it, expect } from 'vitest'
import { computeThumbnailSize } from '../src/lib/thumbnail.js'

describe('computeThumbnailSize', () => {
  it('横長: 長辺（幅）を maxSide に合わせて縮小する', () => {
    const r = computeThumbnailSize(1600, 900, 240)
    expect(r.scale).toBeCloseTo(0.15, 9)
    expect(r.width).toBe(240)
    expect(r.height).toBe(135)
  })

  it('縦長: 長辺（高さ）を maxSide に合わせて縮小する', () => {
    const r = computeThumbnailSize(900, 1600, 240)
    expect(r.scale).toBeCloseTo(0.15, 9)
    expect(r.height).toBe(240)
    expect(r.width).toBe(135)
  })

  it('正方形: 両辺とも maxSide になる', () => {
    const r = computeThumbnailSize(800, 800, 240)
    expect(r.scale).toBeCloseTo(0.3, 9)
    expect(r.width).toBe(240)
    expect(r.height).toBe(240)
  })

  it('元が maxSide より小さいときは拡大しない（scale はちょうど 1）', () => {
    const r = computeThumbnailSize(100, 80, 240)
    expect(r.scale).toBe(1)
    expect(r.width).toBe(100)
    expect(r.height).toBe(80)
  })

  it('極端なアスペクト比: 素朴な四捨五入だと 0 になる辺は 1 に下支えする', () => {
    const r = computeThumbnailSize(10000, 1, 10)
    expect(r.width).toBe(10)
    expect(r.height).toBeGreaterThanOrEqual(1)
    expect(r.height).toBe(1)
  })

  describe('不正な入力', () => {
    it('width が 0 なら全部 0', () => {
      expect(computeThumbnailSize(0, 100, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('width が負なら全部 0', () => {
      expect(computeThumbnailSize(-100, 100, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('width が非有限（NaN）なら全部 0', () => {
      expect(computeThumbnailSize(NaN, 100, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('width が非有限（Infinity）なら全部 0', () => {
      expect(computeThumbnailSize(Infinity, 100, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })

    it('height が 0 なら全部 0', () => {
      expect(computeThumbnailSize(100, 0, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('height が負なら全部 0', () => {
      expect(computeThumbnailSize(100, -100, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('height が非有限（NaN）なら全部 0', () => {
      expect(computeThumbnailSize(100, NaN, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('height が非有限（Infinity）なら全部 0', () => {
      expect(computeThumbnailSize(100, Infinity, 240)).toEqual({ width: 0, height: 0, scale: 0 })
    })

    it('maxSide が 0 なら全部 0', () => {
      expect(computeThumbnailSize(100, 100, 0)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('maxSide が負なら全部 0', () => {
      expect(computeThumbnailSize(100, 100, -240)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('maxSide が非有限（NaN）なら全部 0', () => {
      expect(computeThumbnailSize(100, 100, NaN)).toEqual({ width: 0, height: 0, scale: 0 })
    })
    it('maxSide が非有限（Infinity）なら全部 0', () => {
      expect(computeThumbnailSize(100, 100, Infinity)).toEqual({ width: 0, height: 0, scale: 0 })
    })
  })
})
