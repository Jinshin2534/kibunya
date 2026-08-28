import { FEATURE_NAMES } from './features.js'
import { clampScale } from './labels.js'

/**
 * 決定的な疑似乱数生成器（線形合同法）。同じ seed からは毎回同じ数列を返す。
 * window.__app.seedDays がカメラ無しで再現可能な合成データを作るための土台。
 */
export function makeRng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * 相関のある合成の1日分（Z 相当の特徴量とラベル）を作る。
 * カメラ無しで「育ち」「記録」画面を検証するための唯一の手段（window.__app.seedDays）。
 *
 * - 体調（condition）は eyeOpenL に比例して良くなる
 * - 眠さ（sleepiness）は eyeOpenR に反比例して眠くなくなる
 * - 気分（mood）は顔（z）と無関係、乱数のみで決まる
 *
 * 学習側（lib/model.js）がこの相関を正しく拾えば、体調・眠さは usable になり、
 * 気分は r² ≤ 0 で「まだ顔から当てられません」になるはず。これが Task 17 の
 * 実地の受け入れ条件になる。
 */
export function syntheticDay(rnd) {
  const z = Object.fromEntries(FEATURE_NAMES.map((k) => [k, rnd() * 2 - 1]))
  const labels = {
    condition: clampScale(3 + 2 * z.eyeOpenL + (rnd() - 0.5) * 0.4),
    mood: clampScale(1 + rnd() * 4),
    sleepiness: clampScale(3 - 1.6 * z.eyeOpenR + (rnd() - 0.5) * 0.6),
    tags: rnd() < 0.3 ? ['寝不足'] : [],
  }
  return { z, labels }
}
