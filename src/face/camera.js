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
