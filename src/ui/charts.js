import { polylinePoints } from '../lib/chartData.js'

/** 0〜1 に正規化済みの系列を重ねて描く折れ線。依存なしの素の SVG。 */
export function linesSvg({ series, width = 320, height = 90 }) {
  const n = Math.max(...series.map((s) => s.values.length), 0)
  if (n < 2) return '<p class="note">まだグラフを描けません</p>'

  const paths = series.map((s) =>
    `<polyline fill="none" stroke="${s.color}" stroke-width="2"
       points="${polylinePoints(s.values, n, width, height)}"/>`
  ).join('')

  const legend = series.map((s) =>
    `<span class="legend"><i style="background:${s.color}"></i>${s.label}</span>`
  ).join('')

  return `<svg viewBox="0 0 ${width} ${height}" class="chart" preserveAspectRatio="none">${paths}</svg>
          <div class="legends">${legend}</div>`
}
