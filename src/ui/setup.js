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
    <div class="panel disclaimer">
      <p>顔から気分や体調を読むことは、科学的に確立していません。
      このアプリがするのは<b>あなた個人の中の相関を探すこと</b>だけです。
      相関が見つからなければ「当てられません」と正直に表示します。</p>
      <p>医療目的ではありません。診断でも助言でもありません。</p>
      <p>写真も数値も、この端末の外には出ません。</p>
    </div>
  `
  const samples = []
  // today.js と同じ形: panel はこの関数のトップレベルで持ち、返す stop() が
  // どの時点でも今動いているカメラを確実に止められるようにする。
  let panel = createCapturePanel({
    shots: SHOTS,
    title: 'ふつうの顔を撮ります',
    onShot: ({ features, index }) => {
      samples.push(features)
      if (index >= SHOTS) { panel.stop(); panel = null; finish() }
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

  // 画面から離れるとき（設定画面から再度セットアップに入った、タブ切り替えなど）、
  // 撮影中のカメラが動いたままにならないように。
  return {
    stop() { panel?.stop() },
  }
}
