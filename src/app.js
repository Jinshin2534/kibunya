import { renderShell } from './ui/shell.js'
import { renderSetup } from './ui/setup.js'
import { renderToday } from './ui/today.js'
import { analyze } from './pipeline.js'
import { buildBaseline, toZ, pooledBaseline } from './lib/baseline.js'
import { dateKey } from './lib/dates.js'
import * as db from './store/db.js'

const root = document.querySelector('#app')

const TABS = [
  { key: 'today', label: '今日' },
  { key: 'grow', label: '育ち' },
  { key: 'log', label: '記録' },
  { key: 'settings', label: '設定' },
]

const state = { baseline: null, entries: [], tab: 'today', lastAnalysis: null }

// renderToday が撮影中のカメラを掴んでいるとき、離脱時に確実に止めるためのハンドル。
// 同じ画面を再描画するときも先に呼ぶ（前の撮影が生き残ったまま新しい撮影を
// 二重に始めないように）。
let activeScreen = null

async function load() {
  state.baseline = await db.getBaseline()
  state.entries = await db.allEntries()
}

function predictFor() { return null } // Task 17 でモデルに差し替える

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
      onSaved: async () => { state.entries = await db.allEntries() },
    }) ?? null
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
  async reset() { await db.clearAll(); state.baseline = null; state.entries = []; render() },
}
