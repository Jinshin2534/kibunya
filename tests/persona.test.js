import { describe, it, expect } from 'vitest'
import { speak, growLine, hashString } from '../src/lib/persona.js'

const base = { values: { condition: 4, mood: 3, sleepiness: 2 }, confidence: 0.7, topFeature: 'eyeOpenL', seed: '2026-08-29' }

describe('speak', () => {
  it('同じ入力なら必ず同じ文（決定的）', () => {
    expect(speak(base)).toBe(speak({ ...base }))
  })
  it('seed が違えば言い回しが変わりうる', () => {
    const lines = new Set()
    for (let i = 0; i < 20; i++) lines.add(speak({ ...base, seed: `day-${i}` }))
    expect(lines.size).toBeGreaterThan(1)
  })
  it('自信が低いと ぼかした言い方になる', () => {
    const s = speak({ ...base, confidence: 0.1 })
    expect(/自信ない|あてずっぽう|わからない/.test(s)).toBe(true)
  })
  it('自信が高いと言い切る', () => {
    const s = speak({ ...base, confidence: 0.95 })
    expect(/自信ない|あてずっぽう/.test(s)).toBe(false)
  })
  it('根拠になった特徴量の日本語名が入る', () => {
    expect(speak(base)).toContain('左目の開き')
  })
  it('体調の高低で中身が変わる', () => {
    const low = speak({ ...base, values: { ...base.values, condition: 1 }, seed: 'x' })
    const high = speak({ ...base, values: { ...base.values, condition: 5 }, seed: 'x' })
    expect(low).not.toBe(high)
  })
  it('根拠が無くても文が作れる', () => {
    expect(speak({ ...base, topFeature: null }).length).toBeGreaterThan(0)
  })
})

describe('growLine', () => {
  it('まだ学習できていないときは正直に言う', () => {
    expect(growLine({ usable: false, n: 8, hitRate: 0.3 })).toContain('当てられ')
  })
  it('よく当たっているときは自慢する', () => {
    const s = growLine({ usable: true, n: 60, hitRate: 0.9 })
    expect(s.length).toBeGreaterThan(0)
    expect(s).not.toContain('当てられません')
  })
})

describe('hashString', () => {
  it('同じ文字列なら同じ値', () => expect(hashString('abc')).toBe(hashString('abc')))
  it('違う文字列なら違う値', () => expect(hashString('abc')).not.toBe(hashString('abd')))
  it('常に非負', () => expect(hashString('あ')).toBeGreaterThanOrEqual(0))
})

// ===== Guard Tests =====

describe('Guard: speak with edge cases', () => {
  it('values が完全に無いときにクラッシュしない', () => {
    const result = speak({ topFeature: 'eyeOpenL', seed: 'test', confidence: 0.7 })
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('なんとも言えない')
  })

  it('values が undefined のときにクラッシュしない', () => {
    const result = speak({ values: undefined, topFeature: 'eyeOpenL', seed: 'test', confidence: 0.7 })
    expect(result.length).toBeGreaterThan(0)
  })

  it('condition が非数値のときは無視される', () => {
    const result = speak({ values: { condition: 'invalid', sleepiness: 4 }, topFeature: null, seed: 'test', confidence: 0.7 })
    expect(result).toContain('ちょっと眠そう')
    expect(result).not.toContain('invalid')
  })

  it('seed が omit されたときも動く', () => {
    const result = speak({ values: { condition: 3 }, topFeature: 'eyeOpenL', confidence: 0.7 })
    expect(result.length).toBeGreaterThan(0)
  })

  it('topFeature が無効な名前のときは because が入らない', () => {
    const result = speak({ values: { condition: 3 }, topFeature: 'invalidFeature', seed: 'test', confidence: 0.7 })
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('に出てる')
  })

  it('topFeature が null のときは because が入らない', () => {
    const result = speak({ values: { condition: 3 }, topFeature: null, seed: 'test', confidence: 0.7 })
    expect(result).not.toContain('に出てる')
  })
})

describe('Guard: confidence 信頼度帯の境界値', () => {
  it('confidence = 0.35 未満で LOW opener', () => {
    const result = speak({ ...base, confidence: 0.34, seed: 'boundary-test' })
    expect(/自信ない|あてずっぽう|わからない/.test(result)).toBe(true)
  })

  it('confidence = 0.35 ちょうどで MID opener（0.35 は MID）', () => {
    const result = speak({ ...base, confidence: 0.35, seed: 'boundary-test' })
    expect(/たぶん|見た感じ|なんとなく/.test(result)).toBe(true)
  })

  it('confidence = 0.69 で MID opener', () => {
    const result = speak({ ...base, confidence: 0.69, seed: 'boundary-test' })
    expect(/たぶん|見た感じ|なんとなく/.test(result)).toBe(true)
  })

  it('confidence = 0.7 以上で HIGH opener', () => {
    const result = speak({ ...base, confidence: 0.7, seed: 'boundary-test' })
    expect(/はっきり|わかりやすい|書いてある/.test(result)).toBe(true)
  })

  it('confidence = 1.0 で HIGH opener', () => {
    const result = speak({ ...base, confidence: 1.0, seed: 'boundary-test' })
    expect(/はっきり|わかりやすい|書いてある/.test(result)).toBe(true)
  })
})

describe('Guard: round の clamping', () => {
  it('condition: 0.4 は 1 に丸められる（MIN_CLAMP）', () => {
    const result = speak({ ...base, values: { ...base.values, condition: 0.4 }, seed: 'clamp-test' })
    expect(result).toContain('かなりしんどそう')
  })

  it('condition: 0.6 は 1 に丸められる', () => {
    const result = speak({ ...base, values: { ...base.values, condition: 0.6 }, seed: 'clamp-test' })
    expect(result).toContain('かなりしんどそう')
  })

  it('condition: 5.4 は 5 に丸められる（MAX_CLAMP）', () => {
    const result = speak({ ...base, values: { ...base.values, condition: 5.4 }, seed: 'clamp-test' })
    expect(result).toContain('かなり good')
  })

  it('condition: 5.6 は 6 に丸めてから 5 に clamped', () => {
    const result = speak({ ...base, values: { ...base.values, condition: 5.6 }, seed: 'clamp-test' })
    expect(result).toContain('かなり good')
  })
})

describe('Guard: growLine 閾値の境界値', () => {
  it('usable=true, hitRate=0.844 （rounds to 84%）で 65% 台メッセージ', () => {
    const result = growLine({ usable: true, n: 100, hitRate: 0.844 })
    expect(result).toContain('少しずつ当たるようになってる')
    expect(result).not.toContain('だいぶあなたのことがわかってきた')
  })

  it('usable=true, hitRate=0.85 で 85% メッセージ', () => {
    const result = growLine({ usable: true, n: 100, hitRate: 0.85 })
    expect(result).toContain('だいぶあなたのことがわかってきた')
  })

  it('usable=true, hitRate=0.644 （rounds to 64%）で「当たったり外したり」', () => {
    const result = growLine({ usable: true, n: 100, hitRate: 0.644 })
    expect(result).toContain('当たったり外したり')
    expect(result).not.toContain('少しずつ当たるようになってる')
  })

  it('usable=true, hitRate=0.65 で 65% メッセージ', () => {
    const result = growLine({ usable: true, n: 100, hitRate: 0.65 })
    expect(result).toContain('少しずつ当たるようになってる')
  })

  it('usable=false で「当てられません」メッセージ', () => {
    const result = growLine({ usable: false, n: 10, hitRate: 0.5 })
    expect(result).toContain('当てられません')
  })
})

describe('Guard: hashString robustness', () => {
  it('空文字列でもクラッシュしない', () => {
    const result = hashString('')
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('空文字列は常に同じ値を返す', () => {
    expect(hashString('')).toBe(hashString(''))
  })

  it('大きな文字列でも処理できる', () => {
    const big = 'あ'.repeat(1000)
    const result = hashString(big)
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('負の index を避けるため常に正の値を返す', () => {
    for (let i = 0; i < 100; i++) {
      const h = hashString(`seed-${i}`)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(h)).toBe(true)
    }
  })
})

describe('Guard: values の各フィールドが独立して処理される', () => {
  it('condition のみ欠ける場合', () => {
    const result = speak({ values: { sleepiness: 4 }, topFeature: null, seed: 'test', confidence: 0.7 })
    expect(result).toContain('ちょっと眠そう')
  })

  it('sleepiness のみ欠ける場合', () => {
    const result = speak({ values: { condition: 2 }, topFeature: null, seed: 'test', confidence: 0.7 })
    expect(result).toContain('すこし疲れが残ってる')
  })

  it('両方欠ける場合は「なんとも言えない」が入る', () => {
    const result = speak({ values: {}, topFeature: null, seed: 'test', confidence: 0.7 })
    expect(result).toContain('なんとも言えない')
  })
})

describe('Guard: determinism の再確認（オブジェクト同一性ではなく構造で判定）', () => {
  it('別コンストラクションの同一値でも同じ文が出る', () => {
    const obj1 = { values: { condition: 3, sleepiness: 2 }, confidence: 0.7, topFeature: 'eyeOpenL', seed: 'det-test' }
    const obj2 = { values: { condition: 3, sleepiness: 2 }, confidence: 0.7, topFeature: 'eyeOpenL', seed: 'det-test' }
    expect(obj1).not.toBe(obj2) // 別オブジェクト
    expect(speak(obj1)).toBe(speak(obj2)) // 内容は同じ
  })
})

describe('Guard: 自信のある出だしと空の本文が矛盾しない', () => {
  it('confidence が高くても values が空なら言い切るオープナーにならない', () => {
    const s = speak({ values: {}, confidence: 0.7, topFeature: null, seed: 'contradiction-1' })
    expect(/今日ははっきりしてる|今日はわかりやすい|顔に書いてある/.test(s)).toBe(false)
    expect(/自信ない|あてずっぽう|わからない/.test(s)).toBe(true)
    expect(s).toContain('なんとも言えない')
  })

  it('confidence = 1.0 で values が空でも同様に控えめな出だしになる', () => {
    const s = speak({ values: {}, confidence: 1.0, topFeature: null, seed: 'contradiction-2' })
    expect(/今日ははっきりしてる|今日はわかりやすい|顔に書いてある/.test(s)).toBe(false)
    expect(/自信ない|あてずっぽう|わからない/.test(s)).toBe(true)
  })
})

describe('Guard: growLine の undefined/NaN 対策', () => {
  it('n が無いときに "undefined" を出さない', () => {
    const result = growLine({ usable: false, hitRate: 0.3 })
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('NaN')
  })

  it('n が NaN のときに "NaN" を出さない', () => {
    const result = growLine({ usable: false, n: NaN, hitRate: 0.3 })
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('NaN')
  })

  it('hitRate が無いときに "NaN" を出さず、未計測（当てられません）扱いになる', () => {
    const result = growLine({ usable: true, n: 50 })
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('NaN')
    expect(result).toContain('当てられません')
  })

  it('hitRate が NaN のときに "NaN" を出さず、未計測（当てられません）扱いになる', () => {
    const result = growLine({ usable: true, n: 50, hitRate: NaN })
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('NaN')
    expect(result).toContain('当てられません')
  })
})

describe('speak: mood（気分）が本文に反映される', () => {
  it('mood が指定されると本文に含まれる', () => {
    const s = speak({ values: { mood: 5 }, confidence: 0.5, topFeature: null, seed: 'mood-present' })
    expect(s).toContain('かなり機嫌がいい')
  })

  it('mood が無いときは機嫌に関する語が含まれない', () => {
    const s = speak({ values: { condition: 3 }, confidence: 0.5, topFeature: null, seed: 'mood-absent' })
    expect(s).not.toContain('機嫌')
  })

  it('mood だけの values でも整った文が作れる', () => {
    const s = speak({ values: { mood: 1 }, confidence: 0.5, topFeature: null, seed: 'mood-only' })
    expect(s).toContain('かなり沈んでそう')
    expect(s.endsWith('。')).toBe(true)
  })
})

describe('Guard: プロトタイプチェーンのキーが出力に紛れ込まない', () => {
  it('topFeature が "constructor" のとき because が入らない', () => {
    const result = speak({ values: { condition: 3 }, topFeature: 'constructor', seed: 'test', confidence: 0.7 })
    expect(result).not.toContain('に出てる')
    expect(result).not.toContain('function')
  })

  it('topFeature が "toString" のとき because が入らない', () => {
    const result = speak({ values: { condition: 3 }, topFeature: 'toString', seed: 'test', confidence: 0.7 })
    expect(result).not.toContain('に出てる')
  })
})
