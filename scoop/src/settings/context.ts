import { createContext } from 'react'
import { STRINGS } from '../i18n/strings'
import type { AppSettings, Locale } from '../types'

export type SettingsCtx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (typeof STRINGS)['en']
  settings: AppSettings
  updateSettings: (s: AppSettings) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
}

export const SettingsContext = createContext<SettingsCtx | null>(null)
