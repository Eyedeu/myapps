import { useAppI18n } from '../settings/useAppI18n'
import type { Locale, Screen } from '../types'

export function Home({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const { t, locale, setLocale, setSettingsOpen } = useAppI18n()

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Scoop</h1>
        <p className="lede">{t.tagline}</p>
        <div className="lang-row">
          <label className="field-label" htmlFor="lang">
            {t.language}
          </label>
          <select
            id="lang"
            className="select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
        <button type="button" className="linkish" onClick={() => setSettingsOpen(true)}>
          {t.settings}
        </button>
      </header>

      <main className="card home-cards">
        <button type="button" className="btn primary wide" onClick={() => onNavigate('solo')}>
          {t.homeSolo}
        </button>
        <p className="muted small">{t.soloIntro}</p>

        <button type="button" className="btn primary wide" onClick={() => onNavigate('online')}>
          {t.homeOnline}
        </button>
        <p className="muted small">{t.homeOnlineHint}</p>

        <button type="button" className="btn ghost wide" onClick={() => onNavigate('local')}>
          {t.homeLocal}
        </button>
        <p className="muted small">{t.homeLocalHint}</p>
      </main>
    </div>
  )
}
