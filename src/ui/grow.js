import { TARGETS } from '../lib/labels.js'
import { MIN_ENTRIES, importance, learningCurve } from '../lib/model.js'
import { growLine } from '../lib/persona.js'

/**
 * AI の成績表。当てられていない的は、当てられていないと書く。
 *
 * baseline は「学習曲線」を引き直すために要る。学習曲線（lib/model.js の
 * learningCurve）は entries を先頭から k 件ずつ切り、その時点までの記録だけで
 * 毎回プールし直した基準で Z 化する（先読み防止）。そのためここで渡す baseline は
 * 既にプールしたもの（state.trained が使っているもの）ではなく、
 * セットアップ時点の生の基準（state.baseline）であること。呼び出し側（app.js）を参照。
 */
export function renderGrow(root, { entries, trained, baseline }) {
  root.innerHTML = `<h1>育ち</h1>
    <p class="note">記録 ${entries.length} 件。的中率は 1 件ずつ抜いて測り直した「本当の成績」です。</p>`

  if (entries.length < MIN_ENTRIES) {
    root.insertAdjacentHTML('beforeend',
      `<div class="panel"><h2>まだ育っていない</h2>
       <p class="note">あと ${MIN_ENTRIES - entries.length} 件で学習が始まります。</p></div>`)
    return
  }

  for (const t of TARGETS) {
    const r = trained[t.key]
    const panel = document.createElement('div')
    panel.className = 'panel'
    if (!r) {
      panel.innerHTML = `<h2>${t.label}</h2><p class="note">まだ学習できていません。</p>`
      root.append(panel)
      continue
    }
    const pct = Math.round(r.hitRate * 100)
    // usable でない的の的中率は出さない。ラベルが動いていないだけで
    // 「100% 当たっているが当てられない」という矛盾した表示になるため。
    panel.innerHTML = `
      <h2>${t.label}</h2>
      ${r.usable ? `<div class="meter">
        <span>的中率</span>
        <div class="bar"><i style="width:${pct}%; background:var(--ok)"></i></div>
        <b>${pct}%</b>
      </div>` : ''}
      <p class="note">${growLine({ usable: r.usable, n: r.n, hitRate: r.hitRate })}</p>
      <p class="note">R² ${r.r2 === null ? '—' : r.r2.toFixed(2)}（0 以下は「平均を答えるより悪い」）</p>
    `
    if (r.usable) {
      const top = importance(r.model).slice(0, 4)
      panel.insertAdjacentHTML('beforeend',
        `<h3>顔のどこに出るか</h3>` + top.map((f) => {
          const w = Math.min(100, Math.abs(f.weight) / Math.abs(top[0].weight) * 100)
          return `<div class="meter"><span class="wide">${f.label}</span>
            <div class="bar"><i style="width:${w}%"></i></div>
            <b>${f.weight > 0 ? '＋' : '−'}</b></div>`
        }).join(''))

      const curve = learningCurve(entries, t.key, baseline)
      if (curve.length > 1) {
        const w = 300, h = 60
        const pts = curve.map((p, i) =>
          `${(i / (curve.length - 1)) * w},${h - p.hitRate * h}`).join(' ')
        panel.insertAdjacentHTML('beforeend',
          `<h3>学習曲線</h3>
           <svg viewBox="0 0 ${w} ${h}" class="spark" preserveAspectRatio="none">
             <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>
           </svg>
           <p class="note">${curve[0].n} 件 → ${curve[curve.length - 1].n} 件</p>`)
      }
    }
    root.append(panel)
  }

  root.insertAdjacentHTML('beforeend',
    `<p class="note">的中率は、記録を1件ずつ抜いて学習し直したときの成績です。
     水増しはしていません。当てられないものは当てられないと出します。
     ただし正則化の強さ（λ）もこの同じ検証で選んでいるため、この数字はほんの少し甘めに出ます。</p>`)
}
