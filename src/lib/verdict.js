import { TARGETS, SCALE_MIN, SCALE_MAX } from './labels.js'

/** 見立てと実際のズレがこの幅以内なら「当たり」とみなす。 */
export const HIT_TOLERANCE = 1

/** 予測できた的だけを返す。読めない的のメーターを出すと、それ自体が嘘になる。 */
export function readableTargets(prediction) {
  const values = prediction?.values ?? {}
  return TARGETS.filter((t) => Number.isFinite(values[t.key]))
}

/** 予測できなかった的だけを返す（readableTargets の補集合）。 */
export function unreadableTargets(prediction) {
  const values = prediction?.values ?? {}
  return TARGETS.filter((t) => !Number.isFinite(values[t.key]))
}

/** 1〜5（SCALE_MIN〜SCALE_MAX）の値を、メーターの幅に使える 0〜100 の割合に変換する。 */
export function scaleToPercent(value) {
  return ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100
}

/**
 * 見立て（prediction.values）と答え合わせ（labels）を比べ、
 * 読み取れた的だけについて「当たり／はずれ」を判定する。
 */
export function judgeEntry(prediction, labels) {
  return readableTargets(prediction).map((t) => {
    const predicted = prediction.values[t.key]
    const actual = labels[t.key]
    const diff = Math.abs(predicted - actual)
    return { key: t.key, label: t.label, predicted, actual, diff, hit: diff <= HIT_TOLERANCE }
  })
}
