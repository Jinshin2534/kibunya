import { startCamera, stopCamera } from '../face/camera.js'
import { createDetector, detectFace } from '../face/detector.js'
import { grabFrame, makeThumbnail } from '../face/capture.js'
import { analyze, motionBetween } from '../pipeline.js'

const COUNTDOWN_MS = 3000
// 毎フレームの品質ゲートは輝度と「顔の大きさ / 画像幅」の比しか見ておらず、
// どちらも縮尺に依存しない。ループはこの長辺に縮小したフレームだけを読み、
// 発熱と負荷を避ける。特徴量とサムネイルを作るシャッターの瞬間だけ原寸で読み直す。
const GATE_MAX_SIDE = 320

/**
 * 品質ゲートが全部緑になったら 3 秒カウントして自動でシャッターを切る撮影パネル。
 * ループは縮小読み取り用の gateCanvas で毎フレームの判定だけを行い、
 * シャッターの瞬間だけ原寸の shotCanvas に読み直して特徴量とサムネイルを作る。
 * onShot({ features, quality, thumbnailBlob }) が撮れるたびに呼ばれる。
 */
export function createCapturePanel({ onShot, shots = 1, title = '撮ります' }) {
  const el = document.createElement('div')
  el.className = 'panel capture'
  el.innerHTML = `
    <h2>${title}</h2>
    <div class="viewport">
      <video playsinline muted></video>
      <div class="guide"></div>
      <div class="countdown" hidden></div>
    </div>
    <ul class="checks"></ul>
    <p class="progress"></p>
  `
  const video = el.querySelector('video')
  const checksEl = el.querySelector('.checks')
  const countEl = el.querySelector('.countdown')
  const progressEl = el.querySelector('.progress')
  // 毎フレームの品質ゲート用（縮小して読む・発熱と負荷を避ける）
  const gateCanvas = document.createElement('canvas')
  // シャッター時の特徴量抽出とサムネイル用（原寸で読む）
  const shotCanvas = document.createElement('canvas')

  let stream = null
  let detector = null
  let running = false
  // start() は createDetector()（初回は wasm/モデル読み込み）と startCamera()（権限プロンプトで
  // いつ解決するか分からない）の2つの await をまたぐ。その間に stop() が呼ばれることがある
  // （例: 画面遷移で呼び出し側がこの panel を手放した直後）。stopped はその事実を覚えておき、
  // 各 await の直後でチェックして、遅れて届いた detector/stream を片付けてループを始めずに抜ける。
  let stopped = false
  let prevPoints = null
  let greenSince = 0
  let taken = 0

  function renderChecks(quality) {
    checksEl.innerHTML = quality.checks.map((c) =>
      `<li class="${c.ok ? 'ok' : 'ng'}">${c.ok ? '●' : '○'} ${c.label}${c.ok ? '' : ` — ${c.hint}`}</li>`
    ).join('')
  }

  // シャッターの瞬間だけ shotCanvas に原寸で読み直し、特徴量と品質を再計算してから確定する。
  // landmarks/matrix はループの検出結果をそのまま渡す（検出は video を見るだけで縮尺に依存しない）。
  async function shoot(landmarks, matrix, motion) {
    const { image, width, height } = grabFrame(video, shotCanvas)
    const r = analyze(landmarks, matrix, image, width, height, motion)
    // 縮小フレームでゲートが緑でも、実際に記録される原寸フレームが同じ基準を
    // 満たすとは限らない。記録する当のフレーム自身を再びゲートにかけ、
    // 不合格ならこの1枚はカウントせずに捨て、カウントダウンだけリセットして
    // ループを続行する（ユーザーは原寸でも緑になるまで構え直せばよい）。
    if (!r.quality.ok) {
      renderChecks(r.quality)
      greenSince = 0
      countEl.hidden = true
      return
    }
    taken += 1
    const blob = await makeThumbnail(shotCanvas)
    progressEl.textContent = `${taken} / ${shots} 枚`
    onShot({ features: r.features, quality: r.quality, thumbnailBlob: blob, index: taken })
    greenSince = 0
    if (taken >= shots) stop()
  }

  async function loop(now) {
    if (!running) return
    if (video.readyState >= 2) {
      const { landmarks, matrix } = detectFace(detector, video, now)
      // 縮小読み取り: 輝度と顔サイズ比は縮尺に依存しないので、毎フレームの判定はこれで足りる。
      const { image, width, height } = grabFrame(video, gateCanvas, GATE_MAX_SIDE)
      const points = landmarks ? landmarks.map((p) => ({ x: p.x, y: p.y })) : null
      const motion = motionBetween(prevPoints, points)
      prevPoints = points
      const r = analyze(landmarks, matrix, image, width, height, motion)
      renderChecks(r.quality)

      if (r.quality.ok) {
        if (!greenSince) greenSince = now
        const left = COUNTDOWN_MS - (now - greenSince)
        countEl.hidden = false
        countEl.textContent = String(Math.max(1, Math.ceil(left / 1000)))
        if (left <= 0) {
          countEl.hidden = true
          await shoot(landmarks, matrix, motion)
        }
      } else {
        greenSince = 0
        countEl.hidden = true
      }
    }
    requestAnimationFrame(loop)
  }

  async function start() {
    // すでに stop() 済み（start() が一度も走らないうちに呼ばれた場合を含む）なら、
    // 何も獲得せずに抜ける。
    if (stopped) return
    progressEl.textContent = `0 / ${shots} 枚`
    detector = await createDetector()
    if (stopped) return
    stream = await startCamera(video)
    if (stopped) {
      // 待っている間に stop() が呼ばれていた。ループは始めず、いま届いたばかりの
      // stream をすぐ手放す（でないとカメラのライトが点いたまま誰にも止められなくなる）。
      stopCamera(stream)
      stream = null
      return
    }
    running = true
    requestAnimationFrame(loop)
  }

  function stop() {
    stopped = true
    running = false
    stopCamera(stream)
    stream = null
  }

  return { el, start, stop }
}
