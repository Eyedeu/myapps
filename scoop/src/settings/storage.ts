import type { AppSettings, Locale } from '../types'

const KEYS = {
  settings: 'scoop_settings_v1',
  locale: 'scoop_locale_v1',
  playerId: 'scoop_player_id_v1',
} as const

const defaultSettings: AppSettings = {
  aiProvider: 'openai',
  apiKey: '',
  apiBase: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  firebaseJson: '',
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
