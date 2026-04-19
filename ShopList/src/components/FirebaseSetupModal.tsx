import { useState } from 'react'

type Props = {
  initialJson: string
  initError: string | null
  onSave: (json: string) => void
  /** Tanımlıysa üstte kapat düğmesi gösterilir (ilk kurulumda yok). */
  onClose?: () => void
}

export function FirebaseSetupModal({ initialJson, initError, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(initialJson)
  const [localErr, setLocalErr] = useState<string | null>(null)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <div className="modal">
        {onClose && (
          <button type="button" className="modal-close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        )}
        <h2 id="fb-title">Firebase bağlantısı</h2>
        <p className="modal-lede">
          Listeler cihazlar arasında senkronize olsun diye Firestore kullanılır. Firebase konsolunda
          bir web uygulaması oluşturup yapılandırma JSON’unu buraya yapıştırın (tek seferlik).
        </p>
        <label className="field">
          <span className="field-label">firebaseConfig (JSON)</span>
          <textarea
            className="field-input mono"
            rows={8}
            spellCheck={false}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setLocalErr(null)
            }}
            placeholder='{ "apiKey": "...", "projectId": "...", ... }'
          />
        </label>
        {(initError || localErr) && <p className="error">{initError || localErr}</p>}
        <div className="modal-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const t = draft.trim()
              if (!t) {
                setLocalErr('JSON boş olamaz.')
                return
              }
              onSave(t)
            }}
          >
            Kaydet ve devam et
          </button>
        </div>
        <p className="modal-help">
          README dosyasında Firestore kuralları örneği var. Aile içi kullanım için paylaşılan liste
          kodunu bilen herkes okuyup yazabilir.
        </p>
      </div>
    </div>
  )
}
