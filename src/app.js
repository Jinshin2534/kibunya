import { renderShell } from './ui/shell.js'
import { renderSetup } from './ui/setup.js'
import { renderToday } from './ui/today.js'
import { renderGrow } from './ui/grow.js'
import { renderLog } from './ui/log.js'
import { analyze } from './pipeline.js'
import { buildBaseline, toZ, pooledBaseline } from './lib/baseline.js'
import { dateKey } from './lib/dates.js'
import { trainAll, predictAll, importance } from './lib/model.js'
import { speak } from './lib/persona.js'
import { FEATURE_NAMES } from './lib/features.js'
import { makeRng, syntheticDay } from './lib/synthetic.js'
import * as db from './store/db.js'

const root = document.querySelector('#app')

const TABS = [
  { key: 'today', label: '今日' },
  { key: 'grow', label: '育ち' },
  { key: 'log', label: '記録' },
  { key: 'settings', label: '設定' },
]

const state = { baseline: null, entries: [], trained: {}, tab: 'today', lastAnalysis: null }

// renderToday が撮影中のカメラを掴んでいるとき、離脱時に確実に止めるためのハンドル。
// 同じ画面を再描画するときも先に呼ぶ（前の撮影が生き残ったまま新しい撮影を
// 二重に始めないように）。
let activeScreen = null

async function load() {
  state.baseline = await db.getBaseline()
  state.entries = await db.allEntries()
  // 学習の X も、セットアップの 5 枚だけでなくこれまでの記録を混ぜ直した
  // 基準（Task 7 の pooledBaseline）で Z 化する。保存済みの entry.z は撮影時点の
  // 基準に固定されているので、基準が引き直されるたびに古い Z のまま学習することになる。
  const scale = pooledBaseline(state.baseline, state.entries)
  state.trained = trainAll(state.entries, scale)
}

function predictFor(z) {
  const p = predictAll(state.trained, z)
  if (!p) return null
  const usableKey = Object.keys(p.values)[0]
  const top = usableKey ? importance(state.trained[usableKey].model)[0] : null
  return {
    values: p.values, // 読めた的だけ。既定値で埋めない
    confidence: p.confidence,
    perTarget: p.perTarget,
    line: speak({
      values: p.values,
      confidence: p.confidence,
      topFeature: top?.feature ?? null,
      seed: dateKey(new Date()),
    }),
  }
}

function render() {
  // 画面を描き直す前に、前の画面が撮影中カメラを持っていたら必ず止める。
  // タブを切り替えたとき・同じタブを再描画したときの両方でここを通る。
  activeScreen?.stop?.()
  activeScreen = null

  if (!state.baseline) {
    document.querySelector('#tabbar').innerHTML = ''
    renderSetup(root, {
      onDone: async (b) => { await db.setBaseline(b); state.baseline = b; render() },
    })
    return
  }
  renderShell({ tabs: TABS, current: state.tab, onSelect: (k) => { state.tab = k; render() } })

  if (state.tab === 'today') {
    const today = state.entries.find((e) => e.date === dateKey(new Date())) ?? null
    // セットアップの 5 枚だけでなく、これまでの記録も混ぜた基準で Z 化する
    // （Task 7）。そうしないと平均が 0 付近の特徴量が毎日クランプに張り付く。
    const scale = pooledBaseline(state.baseline, state.entries)
    activeScreen = renderToday(root, {
      baseline: scale,
      todayEntry: today,
      predictFor,
      onSaved: async () => {
        // 保存のあと、記録が増えて動いた基準で学習し直す。
        state.entries = await db.allEntries()
        const scale = pooledBaseline(state.baseline, state.entries)
        state.trained = trainAll(state.entries, scale)
      },
    }) ?? null
    return
  }

  if (state.tab === 'grow') {
    const scale = pooledBaseline(state.baseline, state.entries)
    renderGrow(root, { entries: state.entries, trained: state.trained, baseline: scale })
    return
  }

  if (state.tab === 'log') {
    renderLog(root, { entries: state.entries, trained: state.trained })
    return
  }

  root.innerHTML = `<h1>${TABS.find((t) => t.key === state.tab).label}</h1>
    <p class="note">準備中</p>`
}

await load()
render()

window.__app = {
  feedLandmarks(landmarks, { matrix = null, image = null, width = 640, height = 480 } = {}) {
    const r = analyze(landmarks, matrix, image, width, height, 0)
    state.lastAnalysis = r
    return r
  },
  async setBaselineFrom(featureList) {
    const b = buildBaseline(featureList)
    await db.setBaseline(b)
    state.baseline = b
    render()
    return b
  },
  zOfLast() { return toZ(state.lastAnalysis?.features, pooledBaseline(state.baseline, state.entries)) },
  getState() { return state },
  async reload() { await load(); render() },
  async reset() { await db.clearAll(); state.baseline = null; state.entries = []; state.trained = {}; render() },

  // カメラ無しで「育ち」「記録」を検証するための合成データ。
  // 相関のある値そのもの（決定的乱数・体調/眠さ/気分の式）は src/lib/synthetic.js
  // の純粋関数に持たせてあり、ここは日付を振って DB に書き込む I/O だけを担う。
  async seedDays(n = 40) {
    const rnd = makeRng(12345)
    const base = new Date()
    for (let i = 0; i < n; i++) {
      const { z, labels } = syntheticDay(rnd)
      const d = new Date(base.getTime())
      d.setDate(d.getDate() - (n - 1 - i))
      await db.putEntry({
        date: dateKey(d), capturedAt: d.getTime(),
        features: z, z, quality: { ok: true, checks: [] },
        labels,
        prediction: null,
      })
    }
    if (!state.baseline) {
      await db.setBaseline({ mean: Object.fromEntries(FEATURE_NAMES.map((k) => [k, 0])),
                             sd: Object.fromEntries(FEATURE_NAMES.map((k) => [k, 1])),
                             sampleCount: n, values: [] })
    }
    await this.reload()
    return state.entries.length
  },
}
