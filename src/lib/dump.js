const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 読み込んだダンプが store/db.importAll に安全に渡せる形かを検証する。 */
export function isValidDump(dump) {
  if (!isPlainObject(dump)) return false
  if (!Array.isArray(dump.entries)) return false
  if (!dump.entries.every((e) => isPlainObject(e) && typeof e.date === 'string' && DATE_RE.test(e.date))) {
    return false
  }
  if (dump.baseline != null && !isPlainObject(dump.baseline)) return false
  if (dump.settings != null && !isPlainObject(dump.settings)) return false
  return true
}

/** date 文字列の昇順に並べた新しい配列を返す（引数は変更しない）。 */
export function sortByDate(rows) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date))
}
