import { useContext } from 'react'
import { SettingsContext } from './context'

export function useAppI18n() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('SettingsProvider missing')
  return ctx
}
