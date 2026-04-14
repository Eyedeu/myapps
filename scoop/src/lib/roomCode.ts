const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeRoomCode(length = 6): string {
  const out: string[] = []
  const buf = new Uint32Array(length)
  crypto.getRandomValues(buf)
  for (let i = 0; i < length; i++) {
    out.push(CHARS[buf[i]! % CHARS.length]!)
  }
  return out.join('')
}

export function normalizeRoomCode(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}
