import { describe, it, expect } from 'vitest'
import { analyze, motionBetween } from '../src/pipeline.js'
import { FEATURE_NAMES } from '../src/lib/features.js'
import { makeFace, transformFace } from './helpers/face.js'

const W = 640, H = 480

// offAxisDeg が 0 になる（前方向がカメラ軸と一致した）4x4 変換行列
function frontalMatrix() {
  const m = new Array(16).fill(0)
  m[10] = 1
  return m
}

// 一色に塗られた ImageData 互換オブジェクト（sampling.js が読む image.width/height/data）
function blankImage(w, h, [r, g, b]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255
  }
  return { data, width: w, height: h }
}

describe('analyze', () => {
  it('landmarks が null なら frame/colors/features は null、quality は不合格', () => {
    const r = analyze(null, null, null, W, H)
    expect(r.frame).toBeNull()
    expect(r.colors).toBeNull()
    expect(r.features).toBeNull()
    expect(r.quality.ok).toBe(false)
    expect(r.quality.checks.find((c) => c.key === 'face').ok).toBe(false)
  })

  it('良好な顔なら15個の有限な特徴量と品質判定（全緑）を返す', () => {
    const face = makeFace()
    const matrix = frontalMatrix()
    const image = blankImage(W, H, [150, 150, 150])
    const r = analyze(face, matrix, image, W, H, 0)

    expect(r.frame).not.toBeNull()
    expect(r.colors).not.toBeNull()
    expect(Object.keys(r.features)).toHaveLength(15)
    for (const n of FEATURE_NAMES) {
      expect(Number.isFinite(r.features[n]), `${n} は有限であるべき`).toBe(true)
    }
    expect(r.quality.ok).toBe(true)
    expect(r.quality.checks.every((c) => c.ok)).toBe(true)
  })

  it('image が null でも特徴量は返り、色由来の項目は0になる', () => {
    const face = makeFace()
    const r = analyze(face, frontalMatrix(), null, W, H, 0)

    expect(r.frame).not.toBeNull()
    expect(r.colors).toEqual({
      underEyeL: null, underEyeR: null, cheekL: null, cheekR: null, faceMean: null,
    })
    expect(r.features).not.toBeNull()
    for (const n of FEATURE_NAMES) {
      expect(Number.isFinite(r.features[n])).toBe(true)
    }
    expect(r.features.underEyeDark).toBe(0)
    expect(r.features.underEyeBlue).toBe(0)
    expect(r.features.skinTone).toBe(0)
    expect(r.features.skinRed).toBe(0)
    // 顔色を採取できていない（faceMean が null）ので、明るさは「良好」で埋めず未測定のまま
    // 不合格にすべき。ここを合格値で埋める退行が起きたら light も quality.ok も緑になってしまう。
    expect(r.quality.checks.find((c) => c.key === 'light').ok).toBe(false)
    expect(r.quality.ok).toBe(false)
  })
})

describe('motionBetween', () => {
  it('前フレームがなければ null（0 で埋めない）', () => {
    const face = makeFace()
    expect(motionBetween(null, face)).toBeNull()
    expect(motionBetween(undefined, face)).toBeNull()
  })

  it('2枚が同一なら 0', () => {
    const face = makeFace()
    const same = face.map((p) => ({ x: p.x, y: p.y }))
    expect(motionBetween(face, same)).toBe(0)
  })

  it('2枚が異なれば正の数', () => {
    const face = makeFace()
    const moved = transformFace(face, { dx: 0.02, dy: 0.01 }, W, H)
    const m = motionBetween(face, moved)
    expect(m).toBeGreaterThan(0)
  })

  it('点の数が食い違えば null', () => {
    const face = makeFace()
    const shorter = face.slice(0, face.length - 1)
    expect(motionBetween(face, shorter)).toBeNull()
  })
})
