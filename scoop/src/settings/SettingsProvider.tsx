import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { STRINGS } from '../i18n/strings'
import type { AppSettings, Locale } from '../types'
import { SettingsContext } from './context'
import { loadLocale, loadSettings, saveLocale, saveSettings } from './storage'

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadLocale())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    saveLocale(l)
  }, [])

  const updateSettings = useCallback((s: AppSettings) => {
    setSettings(s)
    saveSettings(s)
  }, [])

  const t = STRINGS[locale]

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      settings,
      updateSettings,
      settingsOpen,
      setSettingsOpen,
    }),
    [locale, setLocale, t, settings, updateSettings, settingsOpen],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
