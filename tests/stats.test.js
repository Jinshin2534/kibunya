import { describe, it, expect } from 'vitest'
import { mean, sd, transpose, matmul, matvec, identity, solve, inverse, pearson } from '../src/lib/stats.js'

describe('mean / sd', () => {
  it('平均を返す', () => expect(mean([1, 2, 3, 4])).toBe(2.5))
  it('空配列は 0', () => expect(mean([])).toBe(0))
  it('標本標準偏差（n-1）を返す', () => expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4))
  it('要素が1個なら 0', () => expect(sd([3])).toBe(0))
})

describe('行列', () => {
  it('転置する', () => {
    expect(transpose([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 4], [2, 5], [3, 6]])
  })
  it('掛ける', () => {
    expect(matmul([[1, 2], [3, 4]], [[5, 6], [7, 8]])).toEqual([[19, 22], [43, 50]])
  })
  it('ベクトルに掛ける', () => {
    expect(matvec([[1, 2], [3, 4]], [1, 1])).toEqual([3, 7])
  })
  it('単位行列', () => {
    expect(identity(2)).toEqual([[1, 0], [0, 1]])
  })
})

describe('solve', () => {
  it('連立一次方程式を解く', () => {
    const x = solve([[2, 1], [1, 3]], [5, 10])
    expect(x[0]).toBeCloseTo(1, 9)
    expect(x[1]).toBeCloseTo(3, 9)
  })
  it('ピボットが 0 の行があっても解ける', () => {
    const x = solve([[0, 1], [1, 0]], [2, 3])
    expect(x[0]).toBeCloseTo(3, 9)
    expect(x[1]).toBeCloseTo(2, 9)
  })
  it('特異行列は null', () => {
    expect(solve([[1, 2], [2, 4]], [1, 2])).toBeNull()
  })
})

describe('inverse', () => {
  it('逆行列を返す（A·A⁻¹ = I）', () => {
    const A = [[4, 7], [2, 6]]
    const Ai = inverse(A)
    const I = matmul(A, Ai)
    expect(I[0][0]).toBeCloseTo(1, 9)
    expect(I[0][1]).toBeCloseTo(0, 9)
    expect(I[1][0]).toBeCloseTo(0, 9)
    expect(I[1][1]).toBeCloseTo(1, 9)
  })
  it('特異行列は null', () => {
    expect(inverse([[1, 2], [2, 4]])).toBeNull()
  })
})

describe('pearson', () => {
  it('完全相関は 1', () => expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 9))
  it('完全逆相関は -1', () => expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 9))
  it('片方が定数なら 0', () => expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0))
})
