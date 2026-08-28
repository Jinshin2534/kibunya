import { describe, it, expect } from 'vitest'
import { sampleDisc, sampleGrid, luminance, redRatio, blueRatio } from '../src/lib/sampling.js'

// 左半分が赤 (200,0,0)、右半分が青 (0,0,100) の 10x10 画像
function makeImage() {
  const width = 10, height = 10
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const left = x < 5
      data[i] = left ? 200 : 0
      data[i + 1] = 0
      data[i + 2] = left ? 0 : 100
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

describe('sampleDisc', () => {
  const img = makeImage()
  it('左側の円は赤を返す', () => {
    expect(sampleDisc(img, 2, 5, 1.5)).toEqual({ r: 200, g: 0, b: 0 })
  })
  it('右側の円は青を返す', () => {
    expect(sampleDisc(img, 7, 5, 1.5)).toEqual({ r: 0, g: 0, b: 100 })
  })
  it('画像の外にはみ出しても内側の画素だけで平均する', () => {
    const s = sampleDisc(img, 0, 0, 1.2)
    expect(s.r).toBe(200)
  })
  it('完全に画像外なら null', () => {
    expect(sampleDisc(img, -50, -50, 1)).toBeNull()
  })
  it('半径が 0 以下なら null', () => {
    expect(sampleDisc(img, 5, 5, 0)).toBeNull()
  })
})

describe('sampleGrid', () => {
  it('画像全体の平均は左右の中間', () => {
    const s = sampleGrid(makeImage(), { x: 0, y: 0, w: 10, h: 10 }, 1)
    expect(s.r).toBeCloseTo(100, 5)
    expect(s.b).toBeCloseTo(50, 5)
  })
  it('範囲が空なら null', () => {
    expect(sampleGrid(makeImage(), { x: 0, y: 0, w: 0, h: 0 }, 1)).toBeNull()
  })
  it('step が 0 以下なら 1 として動作', () => {
    const s1 = sampleGrid(makeImage(), { x: 0, y: 0, w: 10, h: 10 }, 1)
    const s0 = sampleGrid(makeImage(), { x: 0, y: 0, w: 10, h: 10 }, 0)
    const sNeg = sampleGrid(makeImage(), { x: 0, y: 0, w: 10, h: 10 }, -5)
    expect(s0).toEqual(s1)
    expect(sNeg).toEqual(s1)
  })
})

describe('色の指標', () => {
  it('輝度', () => expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 5))
  it('赤み', () => expect(redRatio({ r: 100, g: 50, b: 50 })).toBeCloseTo(0.5, 9))
  it('青み', () => expect(blueRatio({ r: 50, g: 50, b: 100 })).toBeCloseTo(0.5, 9))
  it('真っ黒なら比は 0', () => {
    expect(redRatio({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(blueRatio({ r: 0, g: 0, b: 0 })).toBe(0)
  })
})
