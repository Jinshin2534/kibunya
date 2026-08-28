// 所有権の契約: 返した stream の所有者は呼び出し側。使い終わったら必ず
// stopCamera に渡すこと（渡し忘れるとカメラのライトが点いたままになる）。
export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
    audio: false,
  })
  videoEl.srcObject = stream
  videoEl.setAttribute('playsinline', '')
  videoEl.muted = true
  await videoEl.play()
  return stream
}

export function stopCamera(stream) {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}
