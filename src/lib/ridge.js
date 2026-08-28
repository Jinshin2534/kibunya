import { solve, inverse, transpose, matmul, mean } from './stats.js'

export const LAMBDAS = [0.1, 0.3, 1, 3, 10, 30, 100]

// 先頭に 1 の列を足した設計行列。切片は罰則をかけない。
function augment(X) {
  return X.map((row) => [1, ...row])
}

// A = XaᵀXa + λ·diag(0,1,1,...,1)
function normalMatrix(Xa, lambda) {
  const A = matmul(transpose(Xa), Xa)
  for (let i = 1; i < A.length; i++) A[i][i] += lambda
  return A
}

export function fitRidge(X, y, lambda) {
  if (!X || !X.length || X.length !== y.length) return null
  const Xa = augment(X)
  const A = normalMatrix(Xa, lambda)
  const b = matmul(transpose(Xa), y.map((v) => [v])).map((r) => r[0])
  const wf = solve(A, b)
  if (!wf) return null
  return { intercept: wf[0], w: wf.slice(1), lambda, n: X.length, d: X[0].length }
}

export function predictRidge(model, x) {
  if (!model) return 0
  let s = model.intercept
  for (let j = 0; j < model.w.length; j++) s += model.w[j] * (x[j] ?? 0)
  return s
}

/**
 * 1 件抜いて学習し直したときの、その 1 件の予測値。
 * ハット行列 H = Xa(XaᵀXa+λP)⁻¹Xaᵀ の対角 h_ii を使って
 *   ŷ⁽⁻ⁱ⁾ = y_i − e_i / (1 − h_ii)
 * で一撃で出す。設計行列が固定なのでこれは近似ではなく厳密な等式。
 */
export function looPredictions(X, y, lambda) {
  if (!X || X.length < 3 || X.length !== y.length) return null
  const model = fitRidge(X, y, lambda)
  if (!model) return null
  const Xa = augment(X)
  // fitRidge が同じ A = normalMatrix(Xa, lambda) を solve() で既に解けている。
  // solve() の特異判定（ピボットの大小）は A だけで決まり b には依存しないので、
  // 同じ A に対する inverse() がここで null になることはない。
  const Ainv = inverse(normalMatrix(Xa, lambda))

  const out = []
  const yMean = mean(y)
  for (let i = 0; i < X.length; i++) {
    const xa = Xa[i]
    let h = 0
    for (let a = 0; a < xa.length; a++) {
      let row = 0
      for (let b = 0; b < xa.length; b++) row += Ainv[a][b] * xa[b]
      h += xa[a] * row
    }
    const fitted = predictRidge(model, X[i])
    const denom = 1 - h
    out.push(Math.abs(denom) < 1e-9 ? yMean : y[i] - (y[i] - fitted) / denom)
  }
  return out
}

export function selectLambda(X, y, lambdas = LAMBDAS) {
  let best = { lambda: lambdas[lambdas.length - 1], sse: Infinity }
  for (const lambda of lambdas) {
    const p = looPredictions(X, y, lambda)
    if (!p) continue
    let sse = 0
    for (let i = 0; i < y.length; i++) sse += (y[i] - p[i]) ** 2
    if (sse < best.sse) best = { lambda, sse }
  }
  return best
}
