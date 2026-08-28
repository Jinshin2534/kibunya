import { describe, it, expect } from 'vitest'
import { toFaceFrame, offAxisDeg, dist } from '../src/lib/faceFrame.js'
import { IDX } from '../src/lib/landmarks.js'
import { makeFace, transformFace } from './helpers/face.js'

describe('toFaceFrame', () => {
  const W = 640, H = 480
  const face = makeFace()

  it('原点は両目内眼角の中点（顔座標系で 0,0）', () => {
    const f = toFaceFrame(face, W, H)
    const o = {
      x: (f.points[IDX.eyeInnerL].x + f.points[IDX.eyeInnerR].x) / 2,
      y: (f.points[IDX.eyeInnerL].y + f.points[IDX.eyeInnerR].y) / 2,
    }
    expect(o.x).toBeCloseTo(0, 9)
    expect(o.y).toBeCloseTo(0, 9)
  })

  it('両目の内眼角間距離が 1.0 になる', () => {
    const f = toFaceFrame(face, W, H)
    expect(dist(f.points[IDX.eyeInnerL], f.points[IDX.eyeInnerR])).toBeCloseTo(1, 9)
  })

  it('x+ は被写体の左（画像の右）を向く', () => {
    const f = toFaceFrame(face, W, H)
    expect(f.points[IDX.eyeInnerL].x).toBeGreaterThan(0)
    expect(f.points[IDX.eyeInnerR].x).toBeLessThan(0)
  })

  it('★不変性: 回転・拡大・平行移動しても顔座標系の点は変わらない', () => {
    const base = toFaceFrame(face, W, H)
    const moved = transformFace(face, { deg: 17, scale: 1.6, dx: 0.05, dy: -0.03 }, W, H)
    const after = toFaceFrame(moved, W, H)
    for (let i = 0; i < 478; i++) {
      expect(after.points[i].x).toBeCloseTo(base.points[i].x, 6)
      expect(after.points[i].y).toBeCloseTo(base.points[i].y, 6)
    }
  })

  it('rollDeg は画像上の目線の傾きを返す', () => {
    const tilted = transformFace(face, { deg: 12 }, W, H)
    expect(toFaceFrame(tilted, W, H).rollDeg).toBeCloseTo(12, 4)
  })

  it('scalePx は画素単位の内眼角間距離', () => {
    const f = toFaceFrame(face, W, H)
    expect(f.scalePx).toBeCloseTo(0.1 * W, 6)
  })
})

describe('offAxisDeg', () => {
  // 列優先 4x4。回転なし = 単位行列
  const eye = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]

  it('正面なら 0 度', () => expect(offAxisDeg(eye)).toBeCloseTo(0, 6))

  it('Y 軸まわり 30 度で 30 度', () => {
    const t = Math.PI / 6, c = Math.cos(t), s = Math.sin(t)
    // Ry: 列0=(c,0,-s) 列1=(0,1,0) 列2=(s,0,c)
    const m = [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]
    expect(offAxisDeg(m)).toBeCloseTo(30, 6)
  })

  it('X 軸まわり 20 度で 20 度', () => {
    const t = (20 * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t)
    const m = [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]
    expect(offAxisDeg(m)).toBeCloseTo(20, 6)
  })

  it('行列が無ければ 0', () => expect(offAxisDeg(null)).toBe(0))
})
