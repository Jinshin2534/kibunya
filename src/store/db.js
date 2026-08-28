import { isValidDump, sortByDate } from '../lib/dump.js'

const DB_NAME = 'kibunya'
const DB_VERSION = 1
const STORES = { baseline: 'id', entries: 'date', thumbs: 'date', settings: 'id' }

/**
 * importAll が投げるエラーメッセージ。app.js の import ハンドラは
 * これを err.message と文字列の直接比較で判定しているので、ここを編集したら
 * リテラルのコピーではなくこの定数を使っているか（src/app.js）を確認すること。
 */
export const INVALID_DUMP_ERROR = '読み込めるデータではありません'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      // 開くのに失敗したまま dbPromise を残すと、以後このモジュールの
      // 全ての呼び出しが永久に失敗し続ける。次回また試せるようにする。
      dbPromise = null
      reject(req.error)
    }
    req.onblocked = () => {
      // 他のタブが古いバージョンの接続を開いたままだと onsuccess も
      // onerror も発火せず、呼び出し元が黙って固まってしまう。
      dbPromise = null
      reject(new Error('他のタブでこのアプリが開いたままです。閉じてからもう一度お試しください'))
    }
  })
  return dbPromise
}

function tx(store, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  }))
}

export const getBaseline = () => tx('baseline', 'readonly', (s) => s.get('current'))
export const setBaseline = (b) => tx('baseline', 'readwrite', (s) => s.put({ ...b, id: 'current' }))

export const putEntry = (entry) => tx('entries', 'readwrite', (s) => s.put(entry))
export const allEntries = () =>
  tx('entries', 'readonly', (s) => s.getAll())
    .then((rows) => sortByDate(rows ?? []))

export const getThumb = (date) => tx('thumbs', 'readonly', (s) => s.get(date))
export const putThumb = (date, blob) => tx('thumbs', 'readwrite', (s) => s.put({ date, blob }))
// count() は IDBObjectStore が持つ集計専用のリクエストで、行を1件も読み出さずに
// 件数だけを返す。設定画面は数百枚の Blob を持つ利用者も開くので、getAll() で
// 全件のサムネイルを読み出してから length を数えるのは避ける。
export const thumbCount = () => tx('thumbs', 'readonly', (s) => s.count())

const DEFAULT_SETTINGS = { id: 'app', keepThumbnails: true }
export const getSettings = () =>
  tx('settings', 'readonly', (s) => s.get('app')).then((v) => ({ ...DEFAULT_SETTINGS, ...(v ?? {}) }))
export const setSettings = (patch) =>
  getSettings().then((cur) => tx('settings', 'readwrite', (s) => s.put({ ...cur, ...patch, id: 'app' })))

export async function clearAll() {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const names = Object.keys(STORES)
    const t = db.transaction(names, 'readwrite')
    for (const n of names) t.objectStore(n).clear()
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error('消去を中止しました'))
  })
}

export async function exportAll() {
  const [baseline, entries, settings] = await Promise.all([getBaseline(), allEntries(), getSettings()])
  return { version: DB_VERSION, baseline, entries, settings }
}

export async function importAll(dump) {
  if (!isValidDump(dump)) throw new Error(INVALID_DUMP_ERROR)
  const db = await openDb()
  const names = Object.keys(STORES)
  // 消去と書き込みを1つのトランザクションにまとめる。
  // 別々にすると、消去だけが確定したあとで書き込みが失敗したとき、
  // 元のデータも新しいデータも無い状態でユーザーが取り残される。
  // IndexedDB のトランザクションはもともとアトミックなので、
  // 途中の put が失敗すればトランザクション全体が中止され、
  // 消去前の状態がそのまま残る。
  await new Promise((resolve, reject) => {
    const t = db.transaction(names, 'readwrite')
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error('読み込みを中止しました'))
    for (const n of names) t.objectStore(n).clear()
    // thumbs も消去する: エクスポートにサムネイルは含まれないため、
    // 読み込みは記録一式をサムネイル込みで丸ごと置き換える扱いとする。
    if (dump.baseline) t.objectStore('baseline').put({ ...dump.baseline, id: 'current' })
    for (const e of dump.entries) t.objectStore('entries').put(e)
    t.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...(dump.settings ?? {}), id: 'app' })
  })
}
