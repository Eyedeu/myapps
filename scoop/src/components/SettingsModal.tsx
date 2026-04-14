import { useState } from 'react'
import type { AppSettings } from '../types'
import { useAppI18n } from '../settings/useAppI18n'
import { STRINGS } from '../i18n/strings'

type T = (typeof STRINGS)['en']

function SettingsForm({
  initial,
  t,
  onSave,
  onClose,
}: {
  initial: AppSettings
  t: T
  onSave: (s: AppSettings) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.settings}
    >
      <div className="modal">
        <h2 className="modal-title">{t.settings}</h2>
        <p className="modal-note">{t.settingsNote}</p>

        <label className="field">
          <span className="field-label">{t.apiKey}</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="field-label">{t.apiBase}</span>
          <input
            className="input"
            value={draft.apiBase}
            onChange={(e) => setDraft((d) => ({ ...d, apiBase: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="field-label">{t.model}</span>
          <input
            className="input"
            value={draft.model}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="field-label">{t.firebaseJson}</span>
          <textarea
            className="textarea sm"
            rows={5}
            spellCheck={false}
            value={draft.firebaseJson}
            onChange={(e) => setDraft((d) => ({ ...d, firebaseJson: e.target.value }))}
            placeholder='{"apiKey":"...","authDomain":"...","projectId":"..."}'
          />
        </label>
        <p className="modal-help">{t.firebaseHelp}</p>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t.close}
          </button>
          <button type="button" className="btn primary" onClick={() => onSave(draft)}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen, settings, updateSettings, t } = useAppI18n()

  if (!settingsOpen) return null

  return (
    <SettingsForm
      key={JSON.stringify(settings)}
      initial={settings}
      t={t}
      onSave={(s) => {
        updateSettings(s)
        setSettingsOpen(false)
      }}
      onClose={() => setSettingsOpen(false)}
    />
  )
}
