import { useId, useState } from 'react'
import { defaultListTitle } from '../listTitle'

type Props = {
  open: boolean
  busy: boolean
  error: string | null
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export function NewListSheet({ open, busy, error, onClose, onCreate }: Props) {
  const titleId = useId()
  const [name, setName] = useState('')

  if (!open) return null

  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden />
        <header className="sheet-header">
          <button type="button" className="btn ghost sheet-cancel" disabled={busy} onClick={onClose}>
            İptal
          </button>
          <h2 id={titleId} className="sheet-title">
            Yeni liste
          </h2>
          <span className="sheet-header-spacer" aria-hidden />
        </header>
        <p className="sheet-lede muted">Liste adını yazın; boş bırakırsanız otomatik bir başlık kullanılır.</p>
        <form
          className="sheet-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) void onCreate(name)
          }}
        >
          <label className="field">
            <span className="field-label">Liste adı</span>
            <input
              className="field-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultListTitle()}
              maxLength={80}
              disabled={busy}
              autoFocus
              enterKeyHint="done"
              aria-label="Liste adı"
            />
          </label>
          {error && <p className="error sheet-error">{error}</p>}
          <button type="submit" className="btn primary block sheet-submit" disabled={busy}>
            {busy ? 'Oluşturuluyor…' : 'Listeyi oluştur'}
          </button>
        </form>
      </div>
    </div>
  )
}
