const DB_NAME = 'kibunya'
const DB_VERSION = 1
const STORES = { baseline: 'id', entries: 'date', thumbs: 'date', settings: 'id' }

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
    req.onerror = () => reject(req.error)
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

export const getEntry = (date) => tx('entries', 'readonly', (s) => s.get(date))
export const putEntry = (entry) => tx('entries', 'readwrite', (s) => s.put(entry))
export const allEntries = () =>
  tx('entries', 'readonly', (s) => s.getAll())
    .then((rows) => (rows ?? []).sort((a, b) => a.date.localeCompare(b.date)))

export const getThumb = (date) => tx('thumbs', 'readonly', (s) => s.get(date))
export const putThumb = (date, blob) => tx('thumbs', 'readwrite', (s) => s.put({ date, blob }))

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
  })
}

export async function exportAll() {
  const [baseline, entries, settings] = await Promise.all([getBaseline(), allEntries(), getSettings()])
  return { version: DB_VERSION, baseline, entries, settings }
}

export async function importAll(dump) {
  if (!dump || !Array.isArray(dump.entries)) throw new Error('読み込めるデータではありません')
  await clearAll()
  if (dump.baseline) await setBaseline(dump.baseline)
  for (const e of dump.entries) await putEntry(e)
  if (dump.settings) await setSettings(dump.settings)
}
