import { useId, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useSheetDragToClose } from '../hooks/useSheetDragToClose.ts'
import { ItemQtyEditor } from './ItemQtyEditor.tsx'
import { resolveQtyFields } from '../itemQty'

type Props = {
  db: Firestore
  listId: string
  onClose: () => void
}

export function AddItemSheet({ db, listId, onClose }: Props) {
  const idp = useId()
  const [text, setText] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [unit, setUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const { dragAreaProps, panelStyle } = useSheetDragToClose(!busy, onClose)

  const itemsRef = collection(db, 'shopLists', listId, 'items')

  async function submit() {
    const t = text.trim()
    if (!t) return
    setBusy(true)
    try {
      const q = resolveQtyFields(amountStr, unit)
      const payload: Record<string, unknown> = {
        text: t,
        done: false,
        order: Date.now(),
        createdAt: serverTimestamp(),
      }
      if ('amount' in q) {
        payload.amount = q.amount
        payload.unit = q.unit
      }
      await addDoc(itemsRef, payload)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="sheet-backdrop sheet-backdrop-high"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="sheet-panel sheet-panel-tall"
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idp}-add-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-drag-area"
          aria-label="Aşağı kaydırarak kapat"
          {...dragAreaProps}
        >
          <div className="sheet-handle" aria-hidden />
          <header className="sheet-header">
            <button type="button" className="btn ghost sheet-cancel" disabled={busy} onClick={onClose}>
              İptal
            </button>
            <h2 id={`${idp}-add-title`} className="sheet-title">
              Ürün ekle
            </h2>
            <span className="sheet-header-spacer" aria-hidden />
          </header>
        </div>
        <div className="sheet-form edit-item-form">
          <label className="field">
            <span className="field-label">Ürün adı</span>
            <input
              className="field-input"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={120}
              disabled={busy}
              placeholder="Örn: limon, süt…"
              autoFocus
            />
          </label>
          <ItemQtyEditor
            idPrefix={`${idp}-add`}
            amountStr={amountStr}
            unit={unit}
            disabled={busy}
            onAmountStrChange={setAmountStr}
            onUnitChange={setUnit}
            onClearQty={() => {
              setAmountStr('')
              setUnit('')
            }}
          />
          <button
            type="button"
            className="btn primary block"
            disabled={busy || !text.trim()}
            onClick={() => void submit()}
          >
            {busy ? 'Ekleniyor…' : 'Listeye ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}
