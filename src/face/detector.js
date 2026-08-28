import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'

let cached = null

export async function createDetector() {
  if (cached) return cached
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
  cached = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: '/mediapipe/face_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true,
  })
  return cached
}

export function detectFace(detector, videoEl, timestampMs) {
  const res = detector.detectForVideo(videoEl, timestampMs)
  return {
    landmarks: res.faceLandmarks?.[0] ?? null,
    matrix: res.facialTransformationMatrixes?.[0]?.data ?? null,
  }
}
