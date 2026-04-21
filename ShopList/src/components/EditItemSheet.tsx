import { useId, useState } from 'react'
import type { ListItem } from '../types'
import { amountToInputString, resolveQtyFields } from '../itemQty'
import { useSheetDragToClose } from '../hooks/useSheetDragToClose.ts'
import { ItemQtyEditor } from './ItemQtyEditor.tsx'

type Props = {
  item: ListItem
  onClose: () => void
  onSave: (patch: { text: string; amount?: number; unit?: string; clearQty?: boolean }) => Promise<void>
}

export function EditItemSheet({ item, onClose, onSave }: Props) {
  const idp = useId()
  const [text, setText] = useState(item.text)
  const [amountStr, setAmountStr] = useState(amountToInputString(item.amount))
  const [unit, setUnit] = useState(item.unit ?? '')
  const [busy, setBusy] = useState(false)
  const { dragAreaProps, panelStyle } = useSheetDragToClose(!busy, onClose)

  async function submit() {
    const t = text.trim()
    if (!t) return
    setBusy(true)
    try {
      const q = resolveQtyFields(amountStr, unit)
      if (Object.keys(q).length === 0) {
        await onSave({ text: t, clearQty: true })
      } else {
        await onSave({ text: t, amount: q.amount, unit: q.unit })
      }
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
        aria-labelledby={`${idp}-edit-title`}
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
            <h2 id={`${idp}-edit-title`} className="sheet-title">
              Ürünü düzenle
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
            />
          </label>
          <ItemQtyEditor
            idPrefix={`${idp}-edit`}
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
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
