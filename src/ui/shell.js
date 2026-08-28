export function renderShell({ tabs, current, onSelect }) {
  const bar = document.querySelector('#tabbar')
  bar.innerHTML = ''
  for (const t of tabs) {
    const b = document.createElement('button')
    b.textContent = t.label
    if (t.key === current) b.setAttribute('aria-current', 'page')
    b.onclick = () => onSelect(t.key)
    bar.append(b)
  }
}
