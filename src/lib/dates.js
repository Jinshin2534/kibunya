const pad = (n) => String(n).padStart(2, '0')

export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(date, n) {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + n)
  return d
}
