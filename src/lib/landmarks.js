// MediaPipe Face Mesh（478点）の canonical インデックス。
// L = 被写体から見て左（＝画像では右側）、R = 被写体の右（画像では左側）。
export const IDX = {
  eyeInnerL: 362, eyeOuterL: 263, eyeUpperL: 386, eyeLowerL: 374,
  eyeInnerR: 133, eyeOuterR: 33,  eyeUpperR: 159, eyeLowerR: 145,
  browTopL: 334, browTopR: 105,
  browInnerL: 336, browInnerR: 107,
  noseTip: 1,
  mouthL: 291, mouthR: 61, mouthUpper: 13, mouthLower: 14,
  chin: 152,
  faceEdgeL: 454, faceEdgeR: 234,
  jawL: 397, jawR: 172,
  cheekL: 280, cheekR: 50,
  underEyeL: 450, underEyeR: 230,
}

// 左右対称性の評価に使う対応点（被写体の左, 被写体の右）。
export const MIRROR_PAIRS = [
  [IDX.eyeOuterL, IDX.eyeOuterR],
  [IDX.eyeInnerL, IDX.eyeInnerR],
  [IDX.browTopL, IDX.browTopR],
  [IDX.mouthL, IDX.mouthR],
  [IDX.faceEdgeL, IDX.faceEdgeR],
  [IDX.jawL, IDX.jawR],
  [IDX.cheekL, IDX.cheekR],
]
