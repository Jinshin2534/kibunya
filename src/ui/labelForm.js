import { TARGETS, DEFAULT_TAGS, emptyLabels, normalizeLabels, SCALE_MIN, SCALE_MAX } from '../lib/labels.js'

/** スライダー3本＋タグ。送信すると normalizeLabels を通した値を onSubmit に渡す。 */
export function createLabelForm({ initial, onSubmit, submitLabel = '答え合わせする' }) {
  const value = normalizeLabels(initial ?? emptyLabels())
  const el = document.createElement('form')
  el.className = 'panel'
  el.innerHTML = `
    <h2>今日は実際どうだった？</h2>
    ${TARGETS.map((t) => `
      <label class="slider">
        <span class="slider-head">${t.label}<b data-out="${t.key}">${value[t.key]}</b></span>
        <input type="range" name="${t.key}" min="${SCALE_MIN}" max="${SCALE_MAX}" step="1" value="${value[t.key]}">
        <span class="ends"><i>${t.low}</i><i>${t.high}</i></span>
      </label>`).join('')}
    <div class="tags">
      ${DEFAULT_TAGS.map((t) => `<label class="tag"><input type="checkbox" value="${t}"
        ${value.tags.includes(t) ? 'checked' : ''}><span>${t}</span></label>`).join('')}
    </div>
    <input class="newtag" type="text" placeholder="タグを足す（Enter）">
    <button type="submit">${submitLabel}</button>
  `

  for (const t of TARGETS) {
    const input = el.querySelector(`input[name="${t.key}"]`)
    const out = el.querySelector(`[data-out="${t.key}"]`)
    input.oninput = () => { out.textContent = input.value }
  }

  const newTag = el.querySelector('.newtag')
  newTag.onkeydown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const name = newTag.value.trim()
    if (!name) return
    const box = el.querySelector('.tags')
    if (![...box.querySelectorAll('input')].some((i) => i.value === name)) {
      const l = document.createElement('label')
      l.className = 'tag'
      l.innerHTML = `<input type="checkbox" value="${name}" checked><span>${name}</span>`
      box.append(l)
    }
    newTag.value = ''
  }

  el.onsubmit = (e) => {
    e.preventDefault()
    const tags = [...el.querySelectorAll('.tags input:checked')].map((i) => i.value)
    const raw = { tags }
    for (const t of TARGETS) raw[t.key] = Number(el.querySelector(`input[name="${t.key}"]`).value)
    onSubmit(normalizeLabels(raw))
  }

  return el
}
