/** Resize and compress to JPEG data URL for vision APIs / Firestore size limits. */
export async function compressImageToDataUrl(
  file: File,
  maxW = 900,
  quality = 0.72,
  maxBytes = 180_000,
): Promise<string> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')

  let width = maxW
  let q = quality
  let out = ''

  for (let attempt = 0; attempt < 7; attempt++) {
    const scale = Math.min(1, width / bmp.width)
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    out = canvas.toDataURL('image/jpeg', q)
    const bytes = Math.floor((out.length * 3) / 4)
    if (bytes <= maxBytes) return out
    width = Math.max(320, Math.floor(width * 0.85))
    q = Math.max(0.42, q - 0.06)
  }

  return out
}
