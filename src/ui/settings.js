export function renderSettings(root, { settings, entries, baseline, thumbCount, actions }) {
  root.innerHTML = `
    <h1>設定</h1>

    <div class="panel danger-zone">
      <h2>すべて消す</h2>
      <p class="note">記録 ${entries.length} 件、写真 ${thumbCount > 0 ? `${thumbCount} 枚` : 'なし'}、
      ベースライン ${baseline ? `${baseline.sampleCount} 枚` : 'なし'}。
      このデータはこの端末の中にだけあります。消すと元に戻せません。</p>
      <button class="danger" data-act="clear">全部消す</button>
    </div>

    <div class="panel">
      <h2>顔の写真</h2>
      <label class="switch">
        <input type="checkbox" data-act="thumbs" ${settings.keepThumbnails ? 'checked' : ''}>
        <span>撮った顔のサムネイルを残す（記録画面で見返せます）</span>
      </label>
      <p class="note">オフにすると、以降は数値だけを保存します。すでに保存した写真は残ります。</p>
    </div>

    <div class="panel">
      <h2>ふつうの顔を覚え直す</h2>
      <p class="note">髪型・眼鏡・季節などで顔の写り方が変わったときに。撮り直しても、
      これまでの記録は新しい基準で測り直されます。ただし写り方が大きく変わっていると、
      古い記録と混ざって当たりにくくなることがあります。</p>
      <button class="ghost" data-act="rebuild">撮り直す</button>
    </div>

    <div class="panel">
      <h2>持ち出す / 戻す</h2>
      <p class="note">JSON で書き出せます（写真は含みません）。</p>
      <button class="ghost" data-act="export">書き出す</button>
      <label class="ghost filebtn">読み込む<input type="file" accept="application/json" hidden data-act="import"></label>
    </div>
  `

  root.querySelector('[data-act="clear"]').onclick = () => {
    if (confirm('記録・写真・ベースラインをすべて消します。元に戻せません。よろしいですか？')) {
      actions.onClearAll()
    }
  }
  root.querySelector('[data-act="thumbs"]').onchange = (e) => actions.onToggleThumbnails(e.target.checked)
  root.querySelector('[data-act="rebuild"]').onclick = () => actions.onRebuildBaseline()
  root.querySelector('[data-act="export"]').onclick = () => actions.onExport()
  root.querySelector('[data-act="import"]').onchange = (e) => {
    const file = e.target.files?.[0]
    if (file) actions.onImport(file)
  }
}
