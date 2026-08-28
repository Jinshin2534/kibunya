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

  it('y+ は下を向く（一貫した符号反転を検出する）', () => {
    const f = toFaceFrame(face, W, H)
    expect(f.points[IDX.chin].y).toBeGreaterThan(0)     // 顎は目より下
    expect(f.points[IDX.browTopL].y).toBeLessThan(0)    // 眉は目より上
  })

  it('鏡像になっていない（回転と拡大だけで写る）', () => {
    // 被写体の左にある点は +x、右にある点は -x。反射が混じるとここが入れ替わる。
    const f = toFaceFrame(face, W, H)
    expect(f.points[IDX.faceEdgeL].x).toBeGreaterThan(0)
    expect(f.points[IDX.faceEdgeR].x).toBeLessThan(0)
    expect(f.points[IDX.mouthL].x).toBeGreaterThan(0)
    expect(f.points[IDX.mouthR].x).toBeLessThan(0)
  })

  it('両目の内眼角が重なっても NaN を出さず、scalePx が 0 になる', () => {
    // 顔が潰れて検出されたときの退化ケース。ここで NaN を出すと後段が全部汚れるので、
    // 有限値のまま scalePx = 0 を返し、撮影品質ゲート（顔の大きさ）が弾く形にしてある。
    const degenerate = makeFace({ [IDX.eyeInnerL]: { x: 0.45, y: 0.40, z: 0 } })
    const f = toFaceFrame(degenerate, W, H)
    expect(f.scalePx).toBe(0)
    for (const p of f.points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('rollDeg は画像上の目線の傾きを返す', () => {
    const tilted = transformFace(face, { deg: 12 }, W, H)
    expect(toFaceFrame(tilted, W, H).rollDeg).toBeCloseTo(12, 6)
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

  it('行列が無ければ null（未測定は正面扱いにしない）', () => expect(offAxisDeg(null)).toBe(null))

  it('要素が足りない行列も null（未測定は正面扱いにしない）', () => expect(offAxisDeg([1, 0, 0])).toBe(null))
})
