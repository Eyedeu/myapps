/** Resize and compress to JPEG data URL for vision APIs / Firestore size limits. */
export async function compressImageToDataUrl(
  file: File,
  maxW = 900,
  quality = 0.72,
): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxW / bmp.width)
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(bmp, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}
