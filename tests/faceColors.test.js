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

// 1px 幅の縦縞（偶数列/奇数列で色が変わる）。グリッドの歩幅（何列おきに拾うか）を
// faceMean の値の違いとして観測できるようにするための画像。
function stripeImage(colorEven, colorOdd) {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [R, G, B] = x % 2 === 0 ? colorEven : colorOdd
      const i = (y * W + x) * 4
      data[i] = R; data[i + 1] = G; data[i + 2] = B; data[i + 3] = 255
    }
  }
  return { data, width: W, height: H }
}

// 外接矩形が画像全体（x: 0〜99, y: 0〜99）になるように、両端に landmark を置く
function landmarksSpanningImage() {
  return landmarksAt({
    [IDX.underEyeR]: { x: 0, y: 0 },
    [IDX.underEyeL]: { x: 0.99, y: 0.99 },
  })
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

  it('scalePx が非有限（Infinity/NaN）のときは 1 画素刻みにフォールバックする', () => {
    // 非有限な scalePx は「測れていない」とみなして step=1（step=8 の場合と同じ）に倒す。
    // 落ちないことだけでなく、実際に同じ平均値になることまで確認する。
    const img = stripeImage([200, 0, 0], [0, 0, 100])
    const lm = landmarksSpanningImage()

    const stepOne = sampleFaceColors(img, lm, W, H, 8) // step = max(1, round(8/8)) = 1 の基準値

    for (const scalePx of [Infinity, NaN]) {
      const c = sampleFaceColors(img, lm, W, H, scalePx)
      expect(c.faceMean.r).toBeCloseTo(stepOne.faceMean.r, 5)
      expect(c.faceMean.g).toBeCloseTo(stepOne.faceMean.g, 5)
      expect(c.faceMean.b).toBeCloseTo(stepOne.faceMean.b, 5)
      // 半径 = DISC_RATIO * scalePx も非有限になるので、円は引き続きすべて null
      expect(c.underEyeL).toBeNull()
      expect(c.underEyeR).toBeNull()
      expect(c.cheekL).toBeNull()
      expect(c.cheekR).toBeNull()
    }
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
    // faceMean は計算されるべき（外接矩形が clamped される）で、既知の色に一致するはず
    expect(c.faceMean).not.toBeNull()
    expect(c.faceMean.r).toBeCloseTo(150, 5)
    expect(c.faceMean.g).toBeCloseTo(150, 5)
    expect(c.faceMean.b).toBeCloseTo(150, 5)
  })

  it('歩幅は顔の大きさに比例する（step 1 と step 2 で異なる平均になる）', () => {
    // 縦縞画像なら、拾う列が変われば faceMean も変わる。これで
    // 「/ 8 を忘れた」ような歩幅の計算ミスを検出できる。
    const img = stripeImage([200, 0, 0], [0, 0, 100])
    const lm = landmarksSpanningImage()

    const step1 = sampleFaceColors(img, lm, W, H, 8)  // step = max(1, round(8/8)) = 1
    const step2 = sampleFaceColors(img, lm, W, H, 16) // step = max(1, round(16/8)) = 2

    // step 1: 全100列（偶数50・奇数50）を拾うので両色の平均
    expect(step1.faceMean.r).toBeCloseTo(100, 5)
    expect(step1.faceMean.g).toBeCloseTo(0, 5)
    expect(step1.faceMean.b).toBeCloseTo(50, 5)

    // step 2: x=0,2,4,... の偶数列だけを拾うので偶数色そのまま
    expect(step2.faceMean.r).toBeCloseTo(200, 5)
    expect(step2.faceMean.g).toBeCloseTo(0, 5)
    expect(step2.faceMean.b).toBeCloseTo(0, 5)

    // 歩幅が違えば結果も違う、という関係そのものを保証する
    expect(step1.faceMean.r).not.toBeCloseTo(step2.faceMean.r, 5)
  })

  it('とても小さい scalePx でもステップは 1 に floor される（全画素平均になる）', () => {
    // scalePx = 0.1 → step = Math.max(1, Math.round(0.1 / 8)) = Math.max(1, 0) = 1
    const img = stripeImage([200, 0, 0], [0, 0, 100])
    const lm = landmarksSpanningImage()
    const c = sampleFaceColors(img, lm, W, H, 0.1)
    // 全列を拾うので、両色の平均に一致する
    expect(c.faceMean.r).toBeCloseTo(100, 5)
    expect(c.faceMean.g).toBeCloseTo(0, 5)
    expect(c.faceMean.b).toBeCloseTo(50, 5)
  })

  it('とても大きい scalePx ではステップが大きくなり間引かれた値になる', () => {
    // scalePx = 800 → step = Math.max(1, Math.round(800 / 8)) = 100
    // 外接矩形の幅も100なので x=0（偶数色）だけが拾われる
    const img = stripeImage([200, 0, 0], [0, 0, 100])
    const lm = landmarksSpanningImage()
    const c = sampleFaceColors(img, lm, W, H, 800)
    expect(c.faceMean.r).toBeCloseTo(200, 5)
    expect(c.faceMean.g).toBeCloseTo(0, 5)
    expect(c.faceMean.b).toBeCloseTo(0, 5)
  })

  it('landmarks が全て画像の外にある場合 faceMean は null', () => {
    // 全ての landmark が画像外なら、外接矩形が無効になり faceMean は null
    const img = blankImage([200, 200, 200])
    const lm = Array.from({ length: 478 }, () => ({ x: 5.0, y: 5.0, z: 0 }))
    const c = sampleFaceColors(img, lm, W, H, scalePx)
    expect(c.faceMean).toBeNull()
  })
})
