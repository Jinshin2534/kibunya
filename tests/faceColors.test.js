import { describe, it, expect } from 'vitest'
import { sampleFaceColors } from '../src/lib/faceColors.js'
import { IDX } from '../src/lib/landmarks.js'

const W = 100, H = 100

// 塗り分けできる真っ白なキャンバス
function blankImage(base = [255, 255, 255]) {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = base[0]; data[i * 4 + 1] = base[1]
    data[i * 4 + 2] = base[2]; data[i * 4 + 3] = 255
  }
  return { data, width: W, height: H }
}

function paintDisc(img, cx, cy, r, [R, G, B]) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
      const i = (y * W + x) * 4
      img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B
    }
  }
}

// 全点を顔の中央に置き、必要な点だけ位置を与える（正規化座標）
function landmarksAt(map) {
  const pts = new Array(478).fill(0).map(() => ({ x: 0.5, y: 0.5, z: 0 }))
  for (const [idx, p] of Object.entries(map)) pts[idx] = { ...p, z: 0 }
  return pts
}

describe('sampleFaceColors', () => {
  const scalePx = 20 // 半径は 0.18 * 20 = 3.6px

  it('目の下と頬をそれぞれの場所の色で拾う', () => {
    const img = blankImage([200, 200, 200])
    paintDisc(img, 30, 40, 5, [50, 40, 60])    // 右目の下（画像の左）
    paintDisc(img, 70, 40, 5, [50, 40, 60])    // 左目の下
    paintDisc(img, 30, 60, 5, [180, 140, 130]) // 右頬
    paintDisc(img, 70, 60, 5, [180, 140, 130]) // 左頬

    const lm = landmarksAt({
      [IDX.underEyeR]: { x: 0.30, y: 0.40 },
      [IDX.underEyeL]: { x: 0.70, y: 0.40 },
      [IDX.cheekR]: { x: 0.30, y: 0.60 },
      [IDX.cheekL]: { x: 0.70, y: 0.60 },
    })

    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.underEyeL.r).toBeCloseTo(50, 5)
    expect(c.underEyeR.r).toBeCloseTo(50, 5)
    expect(c.cheekL.r).toBeCloseTo(180, 5)
    expect(c.cheekR.g).toBeCloseTo(140, 5)
  })

  it('faceMean は顔の外接矩形の平均', () => {
    const img = blankImage([120, 120, 120])
    const lm = landmarksAt({})
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.faceMean.r).toBeCloseTo(120, 5)
  })

  it('画像の外にある点は null', () => {
    const img = blankImage()
    const lm = landmarksAt({ [IDX.cheekL]: { x: 5.0, y: 5.0 } })
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.cheekL).toBeNull()
    expect(c.cheekR).not.toBeNull()
  })

  it('scalePx が 0 でも落ちない', () => {
    const c = sampleFaceColors(blankImage(), landmarksAt({}), W, H, 0)
    expect(c.underEyeL).toBeNull()
    expect(c.faceMean).not.toBeNull()
  })

  // 追加の守備テスト

  it('負の scalePx でも落ちない', () => {
    // 半径が負になると全ディスクが null、でも faceMean は残る
    const c = sampleFaceColors(blankImage([100, 100, 100]), landmarksAt({}), W, H, -10)
    expect(c.underEyeL).toBeNull()
    expect(c.underEyeR).toBeNull()
    expect(c.cheekL).toBeNull()
    expect(c.cheekR).toBeNull()
    expect(c.faceMean).not.toBeNull()
  })

  it('scalePx が Infinity でも落ちない', () => {
    // Infinity の半径でも faceMean は計算できる（step の計算で 0/8=0 → Math.max(1,0)=1）
    const c = sampleFaceColors(blankImage([80, 80, 80]), landmarksAt({}), W, H, Infinity)
    expect(c.faceMean).not.toBeNull()
  })

  it('scalePx が NaN でも落ちない', () => {
    // NaN の時は step = Math.max(1, Math.round((NaN || 8) / 8)) = Math.max(1, Math.round(1)) = 1
    const c = sampleFaceColors(blankImage([90, 90, 90]), landmarksAt({}), W, H, NaN)
    expect(c.faceMean).not.toBeNull()
  })

  it('underEyeR が画像の外にある場合だけ null', () => {
    // underEyeR だけ外に出す
    const img = blankImage([200, 200, 200])
    paintDisc(img, 70, 40, 5, [50, 50, 50])
    const lm = landmarksAt({
      [IDX.underEyeR]: { x: 5.0, y: 5.0 },  // 画像外
      [IDX.underEyeL]: { x: 0.70, y: 0.40 }, // 画像内
      [IDX.cheekR]: { x: 0.5, y: 0.5 },
      [IDX.cheekL]: { x: 0.5, y: 0.5 },
    })
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.underEyeR).toBeNull()
    expect(c.underEyeL).not.toBeNull()
  })

  it('underEyeL が画像の外にある場合だけ null', () => {
    const img = blankImage([200, 200, 200])
    paintDisc(img, 30, 40, 5, [50, 50, 50])
    const lm = landmarksAt({
      [IDX.underEyeR]: { x: 0.30, y: 0.40 }, // 画像内
      [IDX.underEyeL]: { x: 5.0, y: 5.0 },   // 画像外
      [IDX.cheekR]: { x: 0.5, y: 0.5 },
      [IDX.cheekL]: { x: 0.5, y: 0.5 },
    })
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.underEyeL).toBeNull()
    expect(c.underEyeR).not.toBeNull()
  })

  it('cheekR が画像の外にある場合だけ null', () => {
    const img = blankImage([200, 200, 200])
    paintDisc(img, 70, 60, 5, [150, 150, 150])
    const lm = landmarksAt({
      [IDX.underEyeR]: { x: 0.5, y: 0.5 },
      [IDX.underEyeL]: { x: 0.5, y: 0.5 },
      [IDX.cheekR]: { x: 5.0, y: 5.0 },     // 画像外
      [IDX.cheekL]: { x: 0.70, y: 0.60 },   // 画像内
    })
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.cheekR).toBeNull()
    expect(c.cheekL).not.toBeNull()
  })

  it('cheekL が画像の外にある場合だけ null', () => {
    const img = blankImage([200, 200, 200])
    paintDisc(img, 30, 60, 5, [150, 150, 150])
    const lm = landmarksAt({
      [IDX.underEyeR]: { x: 0.5, y: 0.5 },
      [IDX.underEyeL]: { x: 0.5, y: 0.5 },
      [IDX.cheekR]: { x: 0.30, y: 0.60 },   // 画像内
      [IDX.cheekL]: { x: 5.0, y: 5.0 },     // 画像外
    })
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.cheekL).toBeNull()
    expect(c.cheekR).not.toBeNull()
  })

  it('外接矩形の計算で画像端を超えた時に clamp される', () => {
    // landmarks が画像外に出た場合、外接矩形は画像内に収まるように計算される
    const img = blankImage([150, 150, 150])
    const lm = landmarksAt({
      [IDX.underEyeR]: { x: -0.1, y: -0.1 }, // 負の座標
      [IDX.underEyeL]: { x: 1.1, y: 1.1 },   // 画像外
    })
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    // faceMean は計算されるべき（外接矩形が clamped される）
    expect(c.faceMean).not.toBeNull()
  })

  it('とても小さい scalePx でステップが 1 で計算される', () => {
    // scalePx = 0.1 → step = Math.max(1, Math.round(0.1 / 8)) = Math.max(1, 0) = 1
    // 一つのステップが 1 でサンプリングされる
    const img = blankImage([111, 111, 111])
    const lm = landmarksAt({})
    const c = sampleFaceColors(img, lm, W, H, 0.1)
    expect(c.faceMean).not.toBeNull()
    // ステップが 1 なので細かくサンプリングされるが、平均は 111 に近い
    expect(c.faceMean.r).toBeCloseTo(111, 1)
  })

  it('とても大きい scalePx でステップが大きくなる', () => {
    // scalePx = 320 → step = Math.max(1, Math.round(320 / 8)) = Math.max(1, 40) = 40
    // 一つのステップが 40 で粗くサンプリングされる
    const img = blankImage([99, 99, 99])
    const lm = landmarksAt({})
    const c = sampleFaceColors(img, lm, W, H, 320)
    expect(c.faceMean).not.toBeNull()
    // ステップが大きい場合でも平均色は計算される
    expect(c.faceMean.r).toBeCloseTo(99, 1)
  })

  it('landmarks が全て画像の外にある場合 faceMean は null', () => {
    // 全ての landmark が画像外なら、外接矩形が無効になり faceMean は null
    const img = blankImage([200, 200, 200])
    const lm = new Array(478).fill({ x: 5.0, y: 5.0, z: 0 })
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.faceMean).toBeNull()
  })
})
