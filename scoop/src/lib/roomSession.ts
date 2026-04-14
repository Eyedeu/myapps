import { normalizeRoomCode } from './roomCode'

const SESSION_KEY = 'scoop_online_room_v1'
const JOIN_PARAMS = ['join', 'room'] as const

export type OnlineRoomSession = {
  v: 1
  roomId: string
  role: 'host' | 'join'
  displayName: string
}

export function saveOnlineSession(session: Omit<OnlineRoomSession, 'v'>): void {
  const payload: OnlineRoomSession = { v: 1, ...session }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
}

export function loadOnlineSession(): OnlineRoomSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<OnlineRoomSession>
    if (p.v !== 1 || typeof p.roomId !== 'string' || !p.roomId) return null
    return {
      v: 1,
      roomId: p.roomId,
      role: p.role === 'join' ? 'join' : 'host',
      displayName: typeof p.displayName === 'string' ? p.displayName : '',
    }
  } catch {
    return null
  }
}

export function clearOnlineSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

/** Room code from `?join=` or `?room=` (for invite links and refresh). */
export function getJoinCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  for (const key of JOIN_PARAMS) {
    const v = params.get(key)
    if (v) {
      const n = normalizeRoomCode(v)
      if (n.length >= 4) return n
    }
  }
  return null
}

export function buildInviteUrl(roomCode: string): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.searchParams.set('join', normalizeRoomCode(roomCode))
  url.hash = ''
  return url.toString()
}

export function stripJoinParamsFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  for (const key of JOIN_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }
  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }
}
