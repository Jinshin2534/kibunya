import { toVector } from './features.js'

/** 今日の顔にいちばん近い過去の日を探す。予測には使わず、根拠の提示だけに使う。 */
export function similarDays(z, entries, k = 3, excludeDate = null) {
  const target = toVector(z)
  return entries
    .filter((e) => e.date !== excludeDate)
    .map((entry) => {
      const v = toVector(entry.z)
      let s = 0
      for (let i = 0; i < target.length; i++) s += (target[i] - v[i]) ** 2
      return { entry, distance: Math.sqrt(s) }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
}
