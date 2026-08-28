import { describe, it, expect } from 'vitest'
import { extractFeatures, toVector, FEATURE_NAMES, FEATURE_LABELS_JA } from '../src/lib/features.js'
import { toFaceFrame } from '../src/lib/faceFrame.js'
import { IDX } from '../src/lib/landmarks.js'
import { makeFace, transformFace } from './helpers/face.js'

const COLORS = {
  underEyeL: { r: 120, g: 100, b: 110 },
  underEyeR: { r: 120, g: 100, b: 110 },
  cheekL: { r: 180, g: 150, b: 140 },
  cheekR: { r: 180, g: 150, b: 140 },
  faceMean: { r: 160, g: 140, b: 130 },
}

const W = 640, H = 480
const featuresOf = (pts, colors = COLORS) => extractFeatures(toFaceFrame(pts, W, H).points, colors)

describe('extractFeatures', () => {
  it('15 本ぴったり返す', () => {
    const f = featuresOf(makeFace())
    expect(FEATURE_NAMES).toHaveLength(15)
    expect(Object.keys(f).sort()).toEqual([...FEATURE_NAMES].sort())
    for (const n of FEATURE_NAMES) expect(Number.isFinite(f[n])).toBe(true)
  })

  it('すべての特徴量に日本語の表示名がある', () => {
    for (const n of FEATURE_NAMES) expect(typeof FEATURE_LABELS_JA[n]).toBe('string')
  })

  it('★不変性: 回転・拡大・平行移動しても特徴量が変わらない', () => {
    const face = makeFace()
    const a = featuresOf(face)
    const b = featuresOf(transformFace(face, { deg: -23, scale: 0.7, dx: -0.06, dy: 0.04 }, W, H))
    for (const n of FEATURE_NAMES) expect(b[n]).toBeCloseTo(a[n], 6)
  })

  it('目を大きく開けると eyeOpen が増える', () => {
    const narrow = featuresOf(makeFace())
    const wide = featuresOf(makeFace({
      [IDX.eyeUpperR]: { x: 0.43, y: 0.36, z: 0 },
      [IDX.eyeLowerR]: { x: 0.43, y: 0.44, z: 0 },
    }))
    expect(wide.eyeOpenR).toBeGreaterThan(narrow.eyeOpenR)
  })

  it('左右で開き方が違うと eyeOpenAsym が 0 から離れる', () => {
    const even = featuresOf(makeFace())
    const uneven = featuresOf(makeFace({ [IDX.eyeUpperL]: { x: 0.57, y: 0.355, z: 0 } }))
    expect(Math.abs(even.eyeOpenAsym)).toBeLessThan(1e-9)
    expect(Math.abs(uneven.eyeOpenAsym)).toBeGreaterThan(0.05)
  })

  it('口角が上がると mouthCornerLift が正になる', () => {
    const flat = featuresOf(makeFace())
    const smile = featuresOf(makeFace({
      [IDX.mouthR]: { x: 0.45, y: 0.59, z: 0 },
      [IDX.mouthL]: { x: 0.55, y: 0.59, z: 0 },
    }))
    expect(smile.mouthCornerLift).toBeGreaterThan(flat.mouthCornerLift)
    expect(smile.mouthCornerLift).toBeGreaterThan(0)
  })

  it('顎が横に広がると faceWidthLower が増える', () => {
    const base = featuresOf(makeFace())
    const puffy = featuresOf(makeFace({
      [IDX.jawR]: { x: 0.38, y: 0.68, z: 0 },
      [IDX.jawL]: { x: 0.62, y: 0.68, z: 0 },
    }))
    expect(puffy.faceWidthLower).toBeGreaterThan(base.faceWidthLower)
  })

  it('目の下が暗いほど underEyeDark が大きい', () => {
    const light = featuresOf(makeFace(), { ...COLORS, underEyeL: { r: 175, g: 148, b: 138 }, underEyeR: { r: 175, g: 148, b: 138 } })
    const dark = featuresOf(makeFace(), { ...COLORS, underEyeL: { r: 90, g: 70, b: 80 }, underEyeR: { r: 90, g: 70, b: 80 } })
    expect(dark.underEyeDark).toBeGreaterThan(light.underEyeDark)
  })

  it('色サンプルが無ければ色由来の特徴量は 0', () => {
    const f = featuresOf(makeFace(), { underEyeL: null, underEyeR: null, cheekL: null, cheekR: null, faceMean: null })
    expect(f.underEyeDark).toBe(0)
    expect(f.underEyeBlue).toBe(0)
    expect(f.skinTone).toBe(0)
    expect(f.skinRed).toBe(0)
  })

  it('左右対称な顔は asymmetry がほぼ 0', () => {
    const sym = []
    for (let i = 0; i < 478; i++) sym.push({ x: 0.5, y: 0.5, z: 0 })
    sym[IDX.eyeInnerR] = { x: 0.45, y: 0.40, z: 0 }
    sym[IDX.eyeInnerL] = { x: 0.55, y: 0.40, z: 0 }
    for (const [l, r] of [[IDX.eyeOuterL, IDX.eyeOuterR], [IDX.browTopL, IDX.browTopR],
                          [IDX.mouthL, IDX.mouthR], [IDX.faceEdgeL, IDX.faceEdgeR],
                          [IDX.jawL, IDX.jawR], [IDX.cheekL, IDX.cheekR]]) {
      sym[l] = { x: 0.58, y: 0.5, z: 0 }
      sym[r] = { x: 0.42, y: 0.5, z: 0 }
    }
    expect(featuresOf(sym).asymmetry).toBeCloseTo(0, 9)
  })

  it('目頭と目尻が重なると eyeOpenR は0（ゼロ割ガード）', () => {
    const f = featuresOf(makeFace({ [IDX.eyeOuterR]: { x: 0.45, y: 0.40, z: 0 } }))
    expect(f.eyeOpenR).toBe(0)
    expect(Number.isFinite(f.eyeOpenR)).toBe(true)
  })

  it('顎の点が顎先と重なると jawSharp は0（角度計算の退化ベクトルガード）', () => {
    const rEqualsChin = featuresOf(makeFace({ [IDX.jawR]: { x: 0.50, y: 0.76, z: 0 } }))
    const lEqualsChin = featuresOf(makeFace({ [IDX.jawL]: { x: 0.50, y: 0.76, z: 0 } }))
    expect(rEqualsChin.jawSharp).toBe(0)
    expect(lEqualsChin.jawSharp).toBe(0)
  })

  it('underEyeL が null でも underEyeR だけで計算する（meanColor の片側 null 分岐）', () => {
    const full = featuresOf(makeFace())
    const oneNull = featuresOf(makeFace(), { ...COLORS, underEyeL: null })
    expect(oneNull.underEyeDark).toBeCloseTo(full.underEyeDark, 9)
    expect(oneNull.underEyeDark).not.toBe(0)
  })

  it('cheekR が null でも cheekL だけで計算する（meanColor のもう片側 null 分岐）', () => {
    const full = featuresOf(makeFace())
    const oneNull = featuresOf(makeFace(), { ...COLORS, cheekR: null })
    expect(oneNull.skinTone).toBeCloseTo(full.skinTone, 9)
    expect(oneNull.skinTone).not.toBe(0)
  })

  it('顔全体の輝度がほぼ0だと underEyeDark と skinTone だけ0になる（faceLum ガード）', () => {
    const f = featuresOf(makeFace(), { ...COLORS, faceMean: { r: 0, g: 0, b: 0 } })
    expect(f.underEyeDark).toBe(0)
    expect(f.skinTone).toBe(0)
    expect(f.underEyeBlue).not.toBe(0)
    expect(f.skinRed).not.toBe(0)
  })
})

describe('toVector', () => {
  it('FEATURE_NAMES の順に並べる', () => {
    const f = featuresOf(makeFace())
    const v = toVector(f)
    expect(v).toHaveLength(15)
    expect(v[0]).toBe(f[FEATURE_NAMES[0]])
    expect(v[14]).toBe(f[FEATURE_NAMES[14]])
  })
  it('欠けている値は 0 で埋める', () => {
    expect(toVector({})).toEqual(new Array(15).fill(0))
  })

  it('NaN や Infinity が混じっていても 0 で埋める（非有限値のガード）', () => {
    const bad = { eyeOpenL: NaN, eyeOpenR: Infinity, eyeOpenAsym: -Infinity }
    const v = toVector(bad)
    expect(v[0]).toBe(0)
    expect(v[1]).toBe(0)
    expect(v[2]).toBe(0)
    for (const x of v) expect(Number.isFinite(x)).toBe(true)
  })
})

describe('FEATURE_NAMES', () => {
  it('順序が固定されている（Task 14 の回帰が位置で重みを引くための契約）', () => {
    expect(FEATURE_NAMES).toEqual([
      'eyeOpenL', 'eyeOpenR', 'eyeOpenAsym', 'lidHeavy',
      'underEyeDark', 'underEyeBlue',
      'faceWidthLower', 'cheekFullness', 'jawSharp',
      'mouthCornerLift', 'browHeight', 'browFurrow',
      'asymmetry', 'skinTone', 'skinRed',
    ])
  })
})
