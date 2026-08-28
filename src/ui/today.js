import { createCapturePanel } from './capturePanel.js'
import { createLabelForm } from './labelForm.js'
import { toZ } from '../lib/baseline.js'
import { dateKey } from '../lib/dates.js'
import { putEntry, putThumb, getSettings } from '../store/db.js'
import { readableTargets, unreadableTargets, scaleToPercent, judgeEntry } from '../lib/verdict.js'

/**
 * 撮る → （あれば）AI の見立て → 答え合わせ → 保存。
 * 予測が無い期間（記録が少ない・当てられない）は、予測せず正直にそう言う。
 */
function unreadableNote(prediction) {
  const out = unreadableTargets(prediction)
  if (!out.length) return ''
  return `<p class="note">${out.map((t) => t.label).join('・')} は、まだ顔から読み取れません。</p>`
}

export function renderToday(root, { baseline, todayEntry, onSaved, predictFor, now = new Date() }) {
  const date = dateKey(now)
  // start() が「もう一度撮る」ボタン経由でも呼べるよう、panel はこの関数の
  // トップレベルで持つ。返す stop() はどの分岐から撮影が始まっても、
  // 今動いているカメラを必ず止められる。
  let panel = null

  function start() {
    root.innerHTML = `<h1>今日</h1><p class="note">${date}</p>`
    panel = createCapturePanel({
      shots: 1,
      title: 'いつも通りに撮ります',
      onShot: ({ features, quality, thumbnailBlob }) => {
        panel.stop()
        panel = null
        showResult(features, quality, thumbnailBlob)
      },
    })
    root.append(panel.el)
    panel.start()
  }

  function showResult(features, quality, thumbnailBlob) {
    const z = toZ(features, baseline)
    const prediction = predictFor ? predictFor(z) : null

    root.innerHTML = `<h1>今日</h1><p class="note">${date}</p>`
    const guess = document.createElement('div')
    guess.className = 'panel'
    if (!prediction) {
      guess.innerHTML = `<h2>まだ、あなたのことがわからない</h2>
        <p class="note">記録がたまると見立てを言うようになります。今日はまず答え合わせだけ。</p>`
    } else {
      guess.innerHTML = `<h2>気分屋の見立て</h2>
        <p class="line">${prediction.line}</p>
        ${readableTargets(prediction).map((t) => `<div class="meter"><span>${t.label}</span>
          <div class="bar"><i style="width:${scaleToPercent(prediction.values[t.key])}%"></i></div>
          <b>${prediction.values[t.key].toFixed(1)}</b></div>`).join('')}
        ${unreadableNote(prediction)}
        <p class="note">自信 ${Math.round(prediction.confidence * 100)}%</p>`
    }
    root.append(guess)

    const form = createLabelForm({
      onSubmit: async (labels) => {
        const entry = {
          date, capturedAt: now.getTime(),
          features, z, quality, labels,
          prediction: prediction ? prediction.values : null,
        }
        await putEntry(entry)
        const s = await getSettings()
        if (s.keepThumbnails && thumbnailBlob) await putThumb(date, thumbnailBlob)
        showVerdict(entry)
      },
    })
    root.append(form)
  }

  function showVerdict(entry) {
    root.innerHTML = `<h1>記録しました</h1><p class="note">${date}</p>`
    const box = document.createElement('div')
    box.className = 'panel'
    if (!entry.prediction) {
      box.innerHTML = `<h2>ありがとう</h2><p class="note">今日の顔と、今日のあなたを覚えました。</p>`
    } else {
      box.innerHTML = `<h2>答え合わせ</h2>` + judgeEntry({ values: entry.prediction }, entry.labels).map((j) =>
        `<div class="row"><span>${j.label}</span>
          <b class="${j.hit ? 'hit' : 'miss'}">${j.hit ? '当たり' : 'はずれ'}</b>
          <small>見立て ${j.predicted.toFixed(1)} / 実際 ${j.actual}</small></div>`
      ).join('')
    }
    root.append(box)
    onSaved(entry)
  }

  root.innerHTML = `<h1>今日</h1><p class="note">${date}</p>`
  if (todayEntry?.labels) {
    root.insertAdjacentHTML('beforeend',
      `<div class="panel"><h2>今日はもう記録しました</h2>
       <p class="note">撮り直すと今日の記録を上書きします。</p></div>`)
    const again = document.createElement('button')
    again.className = 'ghost'
    again.textContent = 'もう一度撮る'
    again.onclick = () => start()
    root.append(again)
  } else {
    start()
  }

  // 画面から離れるとき（タブ切り替えなど）、撮影中のカメラが動いたままにならないように。
  // 「もう一度撮る」から始まった撮影も同じ panel 変数を経由するので、
  // どちらの分岐で始まってもここで確実に止められる。
  return {
    stop() { panel?.stop() },
  }
}
