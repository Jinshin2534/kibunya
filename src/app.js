import { renderSetup } from './ui/setup.js'
import { analyze } from './pipeline.js'
import { buildBaseline, toZ } from './lib/baseline.js'

const root = document.querySelector('#app')

const state = {
  baseline: null,
  lastAnalysis: null,
}

function render() {
  if (!state.baseline) {
    renderSetup(root, { onDone: (b) => { state.baseline = b; render() } })
    return
  }
  root.innerHTML = `<h1>気分屋</h1>
    <p class="note">ベースライン ${state.baseline.sampleCount} 枚を覚えています。</p>`
}

render()

// カメラの無い環境（ヘッドレス）から撮影1回分を流し込む検証用の口。
window.__app = {
  feedLandmarks(landmarks, { matrix = null, image = null, width = 640, height = 480 } = {}) {
    const r = analyze(landmarks, matrix, image, width, height, 0)
    state.lastAnalysis = r
    return r
  },
  setBaselineFrom(featureList) {
    state.baseline = buildBaseline(featureList)
    render()
    return state.baseline
  },
  zOfLast() {
    return toZ(state.lastAnalysis?.features, state.baseline)
  },
  getState() { return state },
  reset() { state.baseline = null; state.lastAnalysis = null; render() },
}
