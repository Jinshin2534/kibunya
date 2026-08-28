import { renderShell } from './ui/shell.js'
import { renderSetup } from './ui/setup.js'
import { renderToday } from './ui/today.js'
import { renderGrow } from './ui/grow.js'
import { renderLog } from './ui/log.js'
import { renderSettings } from './ui/settings.js'
import { analyze } from './pipeline.js'
import { buildBaseline, toZ, pooledBaseline } from './lib/baseline.js'
import { dateKey } from './lib/dates.js'
import { trainAll, predictAll, importance } from './lib/model.js'
import { speak } from './lib/persona.js'
import { FEATURE_NAMES } from './lib/features.js'
import { makeRng, syntheticDay } from './lib/synthetic.js'
import { parseDumpJson } from './lib/dump.js'
import * as db from './store/db.js'

const root = document.querySelector('#app')

const TABS = [
  { key: 'today', label: '今日' },
  { key: 'grow', label: '育ち' },
  { key: 'log', label: '記録' },
  { key: 'settings', label: '設定' },
]

const state = { baseline: null, entries: [], trained: {}, tab: 'today', lastAnalysis: null, settings: null }

// renderToday が撮影中のカメラを掴んでいるとき、離脱時に確実に止めるためのハンドル。
// 同じ画面を再描画するときも先に呼ぶ（前の撮影が生き残ったまま新しい撮影を
// 二重に始めないように）。
let activeScreen = null

async function load() {
  state.baseline = await db.getBaseline()
  state.entries = await db.allEntries()
  state.settings = await db.getSettings()
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
    // renderSetup も renderToday と同じ形で stop() を返す。ここは初回のオンボーディング
    // だけでなく、設定画面の「撮り直す」で state.baseline を null に戻して再入場する
    // 経路も通るため、離脱時にカメラを止められるよう activeScreen に必ず入れる。
    activeScreen = renderSetup(root, {
      onDone: async (b) => { await db.setBaseline(b); await load(); render() },
    }) ?? null
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

  if (state.tab === 'settings') {
    renderSettings(root, {
      settings: state.settings, entries: state.entries, baseline: state.baseline,
      actions: {
        onClearAll: async () => {
          // clearAll は baseline/entries/thumbs/settings の4ストア全てを1つの
          // トランザクションで消す（store/db.js）。消した直後は state.baseline が
          // null になるので、render() の先頭の分岐がそのままセットアップ画面へ導く。
          await db.clearAll()
          await load()
          state.tab = 'today'
          render()
        },
        onToggleThumbnails: async (on) => {
          await db.setSettings({ keepThumbnails: on })
          await load()
          render()
        },
        onRebuildBaseline: () => {
          // state.baseline を null にするだけで、render() の先頭の分岐が
          // セットアップ画面（撮影パネル）を出す。撮り終えて「はじめる」を押すと
          // onDone が新しい基準を保存し、この設定画面（state.tab は変わっていない）
          // に戻ってくる。
          state.baseline = null
          render()
        },
        onExport: async () => {
          // 書き出しは写真（thumbs）を含めない: base64 化すると JSON が肥大化するため。
          const dump = await db.exportAll()
          const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }))
          const a = document.createElement('a')
          a.href = url
          a.download = `kibunya-${dateKey(new Date())}.json`
          // download 開始（クリック）のあとで revoke する。先に revoke すると
          // まだ開始していないダウンロードが失敗することがある。
          a.click()
          URL.revokeObjectURL(url)
        },
        onImport: async (file) => {
          try {
            // JSON として壊れている場合は parseDumpJson が日本語のメッセージで投げる。
            // 形は正しくても中身が不正な場合は db.importAll 側の isValidDump が
            // 「読み込めるデータではありません」を投げる。どちらも err.message が
            // そのまま日本語の文になっているので、alert にそのまま出せる。
            const dump = parseDumpJson(await file.text())
            await db.importAll(dump)
            await load()
            state.tab = 'log'
            render()
          } catch (err) {
            alert(`読み込めませんでした: ${err.message}`)
          }
        },
      },
    })
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
  async reset() { await db.clearAll(); await load(); render() },

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
