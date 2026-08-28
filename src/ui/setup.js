import { createCapturePanel } from './capturePanel.js'
import { buildBaseline } from '../lib/baseline.js'
import { FEATURE_NAMES, FEATURE_LABELS_JA } from '../lib/features.js'

const SHOTS = 5

/**
 * 「ふつうの顔」を 5 枚撮ってベースラインを作る。
 * ここで作った平均と SD が、以降すべての判断の基準になる。
 */
export function renderSetup(root, { onDone }) {
  root.innerHTML = `
    <h1>顔を覚えさせる</h1>
    <p class="note">ふだんの顔を ${SHOTS} 枚撮ります。表情はつくらず、いつも通りで。
    毎日これと同じ撮り方をするので、いつもの場所・いつもの明るさで撮るのがおすすめです。</p>
  `
  const samples = []
  const panel = createCapturePanel({
    shots: SHOTS,
    title: 'ふつうの顔を撮ります',
    onShot: ({ features, index }) => {
      samples.push(features)
      if (index >= SHOTS) { panel.stop(); finish() }
    },
  })
  root.append(panel.el)
  panel.start()

  function finish() {
    const baseline = buildBaseline(samples)
    root.innerHTML = `<h1>覚えました</h1>
      <p class="note">これがあなたの「ふつうの顔」です。今日からのズレを、ここを基準に測ります。</p>`
    const table = document.createElement('div')
    table.className = 'panel'
    table.innerHTML = FEATURE_NAMES.map((n) =>
      `<div class="row"><span>${FEATURE_LABELS_JA[n]}</span>
       <b>${baseline.mean[n].toFixed(3)}</b>
       <small>± ${baseline.sd[n].toFixed(3)}</small></div>`
    ).join('')
    root.append(table)
    const btn = document.createElement('button')
    btn.textContent = 'はじめる'
    btn.onclick = () => onDone(baseline)
    root.append(btn)
  }
}
