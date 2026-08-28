export function mean(xs) {
  if (!xs.length) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

export function sd(xs) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  let s = 0
  for (const x of xs) s += (x - m) * (x - m)
  return Math.sqrt(s / (xs.length - 1))
}

export function transpose(A) {
  const rows = A.length
  const cols = A[0]?.length ?? 0
  const T = []
  for (let j = 0; j < cols; j++) {
    const row = new Array(rows)
    for (let i = 0; i < rows; i++) row[i] = A[i][j]
    T.push(row)
  }
  return T
}

export function matmul(A, B) {
  const n = A.length
  const m = B[0].length
  const k = B.length
  const C = []
  for (let i = 0; i < n; i++) {
    const row = new Array(m).fill(0)
    for (let p = 0; p < k; p++) {
      const a = A[i][p]
      if (a === 0) continue
      for (let j = 0; j < m; j++) row[j] += a * B[p][j]
    }
    C.push(row)
  }
  return C
}

// 部分ピボット付きガウス消去。特異なら null。
export function solve(A, b) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null
    if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t }
    const d = M[col][col]
    for (let j = col; j <= n; j++) M[col][j] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      if (f === 0) continue
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j]
    }
  }
  return M.map((row) => row[n])
}

export function inverse(A) {
  const n = A.length
  const cols = []
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0)
    e[j] = 1
    const c = solve(A, e)
    if (!c) return null
    cols.push(c)
  }
  return transpose(cols)
}

export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return 0
  return sxy / Math.sqrt(sxx * syy)
}
