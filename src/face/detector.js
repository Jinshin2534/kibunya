import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'

let pending = null

// 生成中の Promise 自体をキャッシュする。解決後に代入すると、
// 解決を待たずに2回呼ばれたときに二重に生成され、片方が閉じられないまま漏れる。
// 検出器はアプリのライフタイム全体で使い回す前提で、意図的に close しない。
export function createDetector() {
  if (pending) return pending
  pending = (async () => {
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: '/mediapipe/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    })
  })().catch((err) => {
    pending = null // 失敗は握らない。次の呼び出しでやり直せるようにする
    throw err
  })
  return pending
}

export function detectFace(detector, videoEl, timestampMs) {
  const res = detector.detectForVideo(videoEl, timestampMs)
  return {
    landmarks: res.faceLandmarks?.[0] ?? null,
    matrix: res.facialTransformationMatrixes?.[0]?.data ?? null,
  }
}
