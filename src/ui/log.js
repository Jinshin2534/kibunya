import { linesSvg, normalize } from './charts.js'
import { FEATURE_NAMES, FEATURE_LABELS_JA } from '../lib/features.js'
import { TARGETS } from '../lib/labels.js'
import { similarDays } from '../lib/neighbors.js'
import { tagStats } from '../lib/tags.js'
import { importance } from '../lib/model.js'
import { getThumb } from '../store/db.js'

export function renderLog(root, { entries, trained }) {
  root.innerHTML = `<h1>記録</h1><p class="note">${entries.length} 件</p>`
  if (!entries.length) {
    root.insertAdjacentHTML('beforeend', '<div class="panel"><p class="note">まだ記録がありません。</p></div>')
    return
  }

  // ── 顔の特徴量 と 自己申告 の重ね合わせ ─────────────────
  const chart = document.createElement('div')
  chart.className = 'panel'
  const defaultFeature = importance(trained.condition?.model)[0]?.feature ?? FEATURE_NAMES[0]
  chart.innerHTML = `
    <h2>顔と実感を重ねる</h2>
    <div class="pickers">
      <select class="pick-feature">${FEATURE_NAMES.map((n) =>
        `<option value="${n}" ${n === defaultFeature ? 'selected' : ''}>${FEATURE_LABELS_JA[n]}</option>`).join('')}</select>
      <select class="pick-target">${TARGETS.map((t) =>
        `<option value="${t.key}">${t.label}</option>`).join('')}</select>
    </div>
    <div class="chart-slot"></div>
  `
  root.append(chart)

  const slot = chart.querySelector('.chart-slot')
  const drawChart = () => {
    const f = chart.querySelector('.pick-feature').value
    const t = chart.querySelector('.pick-target').value
    slot.innerHTML = linesSvg({
      series: [
        { values: normalize(entries.map((e) => e.z?.[f] ?? 0)), color: 'var(--accent)', label: FEATURE_LABELS_JA[f] },
        { values: normalize(entries.map((e) => e.labels?.[t] ?? 3)), color: 'var(--ok)', label: TARGETS.find((x) => x.key === t).label },
      ],
    })
  }
  chart.querySelector('.pick-feature').onchange = drawChart
  chart.querySelector('.pick-target').onchange = drawChart
  drawChart()

  // ── 似ている日 ──────────────────────────────────────
  const latest = entries[entries.length - 1]
  const near = similarDays(latest.z, entries, 3, latest.date)
  if (near.length) {
    root.insertAdjacentHTML('beforeend', `<div class="panel">
      <h2>最後に撮った顔に似ている日</h2>
      ${near.map(({ entry, distance }) => `<div class="row">
        <span>${entry.date}</span>
        <b>体調 ${entry.labels?.condition ?? '—'}</b>
        <small>${(entry.labels?.tags ?? []).join('・') || 'タグなし'} / 距離 ${distance.toFixed(2)}</small>
      </div>`).join('')}
    </div>`)
  }

  // ── タグ別の傾向 ────────────────────────────────────
  const tags = tagStats(entries, 3)
  if (tags.length) {
    root.insertAdjacentHTML('beforeend', `<div class="panel">
      <h2>タグが付いた日の顔</h2>
      ${tags.map((t) => `<h3>${t.tag}（${t.count} 日）</h3>` + t.features.map((f) =>
        `<div class="row"><span>${f.label}</span>
         <b>${f.delta >= 0 ? '＋' : '−'}${Math.abs(f.delta).toFixed(2)}σ</b></div>`).join('')).join('')}
      <p class="note">タグが付いた日と付かなかった日の差です。原因ではなく、一緒に起きていたことの要約。</p>
    </div>`)
  }

  // ── 一覧（サムネイル付き）───────────────────────────
  const list = document.createElement('div')
  list.className = 'panel'
  list.innerHTML = '<h2>ぜんぶの記録</h2>'
  const grid = document.createElement('div')
  grid.className = 'thumbgrid'
  list.append(grid)
  root.append(list)

  for (const e of [...entries].reverse()) {
    const cell = document.createElement('div')
    cell.className = 'thumb'
    cell.innerHTML = `<div class="ph"></div>
      <small>${e.date.slice(5)}</small>
      <b>体調 ${e.labels?.condition ?? '—'}</b>`
    grid.append(cell)
    getThumb(e.date).then((t) => {
      if (!t?.blob) return
      const img = document.createElement('img')
      img.src = URL.createObjectURL(t.blob)
      img.alt = `${e.date} の顔`
      // 読み込めても読み込めなくても、いずれかで必ず revoke する。
      // onload だけだと、壊れた画像データのときに Object URL が
      // このタブが生きている間ずっと残ってしまう。
      img.onload = () => URL.revokeObjectURL(img.src)
      img.onerror = () => URL.revokeObjectURL(img.src)
      cell.querySelector('.ph').replaceWith(img)
    })
  }
}
