/**
 * 折れ線グラフ（src/ui/charts.js の linesSvg）を組み立てるための純粋な計算部分。
 * DOM にも SVG 文字列の組み立て自体にも触れず、数値の変換だけをする。
 */

/**
 * 配列を 0〜1 に正規化する（全部同じ値なら 0.5 の直線）。
 * 非有限値（NaN・Infinity）は 0 として扱ってから min/max を取る。
 * こうしないと、記録に欠けた値が1つ混じっただけで Math.min/Math.max が NaN を
 * 返し、系列全体が NaN になって折れ線が描けなくなる（正規化の独立スケーリング
 * という仕様そのものは変えていない。あくまで壊れた入力への下支え）。
 */
export function normalize(values) {
  const safe = values.map((v) => (Number.isFinite(v) ? v : 0))
  const min = Math.min(...safe)
  const max = Math.max(...safe)
  if (!(max > min)) return safe.map(() => 0.5)
  return safe.map((v) => (v - min) / (max - min))
}

/**
 * 0〜1 に正規化済みの値の配列から、<polyline points="..."> に渡す文字列を作る。
 * n は全系列で共通の点数（系列ごとに長さが違っても x 座標の目盛りを揃えるため、
 * 呼び出し側が「いちばん長い系列の長さ」を渡す）。
 * n が 2 未満だと x = i / (n - 1) がゼロ除算になるので、その前提が崩れたら
 * 空文字を返す（呼び出し側の linesSvg は n < 2 のとき別の表示に切り替える）。
 * 値そのものが 0〜1 の範囲外や非有限でも、クランプして NaN を出さない。
 */
export function polylinePoints(values, n, width, height) {
  if (!Number.isFinite(n) || n < 2) return ''
  const x = (i) => (i / (n - 1)) * width
  const y = (v) => height - Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) * height
  return values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
}
