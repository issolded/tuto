// Shrinks a camera photo before it goes over the wire. A raw phone capture is
// several MB; a drawing or a page of handwriting needs none of that resolution.
// For anything bound for Gemini the saving counts twice, since those bytes are
// uploaded again from our server to Google.
export async function downscale(file, maxEdge = 1600, quality = 0.85) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality))
  return blob || file
}

// Cuts the chosen rectangle out of a camera photo, at the photo's own resolution.
//
// `rect` is in fractions of the source (0..1), because the crop is chosen on screen against
// an image the browser has already scaled to fit — fractions survive that, pixels do not.
//
// Deliberately NOT downscaled here, and encoded at 0.95: everything that uploads a photo
// already runs it through downscale() on the way out, and this blob is what that reads. Doing
// the shrink here too would mean two lossy passes over a page of a child's handwriting, which
// is the thing Gemini has to read.
export async function cropToBlob(file, rect) {
  if (!rect) return file
  const bitmap = await createImageBitmap(file)
  const sx = Math.round(rect.x * bitmap.width)
  const sy = Math.round(rect.y * bitmap.height)
  const sw = Math.round(rect.w * bitmap.width)
  const sh = Math.round(rect.h * bitmap.height)
  // A crop that is the whole photo is not a crop; hand back the original rather than
  // re-encoding it for nothing.
  if (sw >= bitmap.width && sh >= bitmap.height) { bitmap.close?.(); return file }
  if (sw < 8 || sh < 8) { bitmap.close?.(); return file }
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)
  bitmap.close?.()
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95))
  return blob || file
}

export function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
