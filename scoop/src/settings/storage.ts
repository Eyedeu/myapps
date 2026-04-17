import type { AppSettings, Locale } from '../types'

const KEYS = {
  settings: 'scoop_settings_v1',
  locale: 'scoop_locale_v1',
  playerId: 'scoop_player_id_v1',
  totalWins: 'scoop_total_wins_v1',
  lastCountedWinToken: 'scoop_last_counted_win_token_v1',
} as const

const DEFAULT_FIREBASE_CONFIG_JSON = JSON.stringify(
  {
    apiKey: 'AIzaSyCZ4htbzs7z7lWo71QfPlv9EceAV4O2Cl8',
    authDomain: 'gen-lang-client-0509202377.firebaseapp.com',
    projectId: 'gen-lang-client-0509202377',
    storageBucket: 'gen-lang-client-0509202377.firebasestorage.app',
    messagingSenderId: '1011248477810',
    appId: '1:1011248477810:web:c4d70282cec962b0fe74eb',
  },
  null,
  2,
)

const defaultSettings: AppSettings = {
  aiProvider: 'openai',
  apiKey: '',
  apiBase: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  firebaseJson: DEFAULT_FIREBASE_CONFIG_JSON,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const merged = { ...defaultSettings, ...parsed }
    if (merged.aiProvider !== 'openai' && merged.aiProvider !== 'gemini') {
      merged.aiProvider = 'openai'
    }
    if (!merged.firebaseJson.trim()) {
      merged.firebaseJson = DEFAULT_FIREBASE_CONFIG_JSON
    }
    return merged
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(s))
}

export function loadLocale(): Locale {
  const v = localStorage.getItem(KEYS.locale) as Locale | null
  if (v === 'en' || v === 'tr' || v === 'de') return v
  return 'en'
}

export function saveLocale(locale: Locale) {
  localStorage.setItem(KEYS.locale, locale)
}

export function getOrCreatePlayerId(): string {
  const existing = sessionStorage.getItem(KEYS.playerId)
  if (existing) return existing
  const id = `p_${crypto.randomUUID()}`
  sessionStorage.setItem(KEYS.playerId, id)
  return id
}

export function loadTotalWins(): number {
  const raw = localStorage.getItem(KEYS.totalWins)
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

export function incrementTotalWins(): number {
  const next = loadTotalWins() + 1
  localStorage.setItem(KEYS.totalWins, String(next))
  return next
}

export function incrementTotalWinsForMatch(matchToken: string): number {
  const token = matchToken.trim()
  if (!token) return loadTotalWins()
  const last = localStorage.getItem(KEYS.lastCountedWinToken)
  if (last === token) return loadTotalWins()
  const next = incrementTotalWins()
  localStorage.setItem(KEYS.lastCountedWinToken, token)
  return next
}
