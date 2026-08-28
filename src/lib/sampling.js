function accumulate(image, px, py, acc) {
  const x = Math.round(px)
  const y = Math.round(py)
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  const i = (y * image.width + x) * 4
  acc.r += image.data[i]
  acc.g += image.data[i + 1]
  acc.b += image.data[i + 2]
  acc.n += 1
}

function finish(acc) {
  if (!acc.n) return null
  return { r: acc.r / acc.n, g: acc.g / acc.n, b: acc.b / acc.n }
}

export function sampleDisc(image, cx, cy, radius) {
  if (!(radius > 0) || !Number.isFinite(radius)) return null
  const acc = { r: 0, g: 0, b: 0, n: 0 }
  const r2 = radius * radius
  const x0 = Math.floor(cx - radius), x1 = Math.ceil(cx + radius)
  const y0 = Math.floor(cy - radius), y1 = Math.ceil(cy + radius)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy > r2) continue
      accumulate(image, x, y, acc)
    }
  }
  return finish(acc)
}

export function sampleGrid(image, box, step) {
  // 画素は整数の格子なので、開始点も歩幅も整数に丸めてから進む。
  // 端数のまま進めると、丸めた先が重なって同じ画素を二度数え、平均が偏る。
  const s = Math.max(1, Math.round(step > 0 ? step : 1))
  const x0 = Math.round(box.x)
  const y0 = Math.round(box.y)
  const xEnd = x0 + Math.max(0, Math.round(box.w))
  const yEnd = y0 + Math.max(0, Math.round(box.h))
  const acc = { r: 0, g: 0, b: 0, n: 0 }
  for (let y = y0; y < yEnd; y += s) {
    for (let x = x0; x < xEnd; x += s) {
      accumulate(image, x, y, acc)
    }
  }
  return finish(acc)
}

export function luminance(c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

export function redRatio(c) {
  const t = c.r + c.g + c.b
  return t > 0 ? c.r / t : 0
}

export function blueRatio(c) {
  const t = c.r + c.g + c.b
  return t > 0 ? c.b / t : 0
}
