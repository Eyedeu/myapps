import { UNITS } from '../itemQty'

type Props = {
  amountStr: string
  unit: string
  onAmountStrChange: (v: string) => void
  onUnitChange: (u: string) => void
  onClearQty: () => void
  disabled?: boolean
  idPrefix: string
}

export function ItemQtyEditor({
  amountStr,
  unit,
  onAmountStrChange,
  onUnitChange,
  onClearQty,
  disabled,
  idPrefix,
}: Props) {
  function pickUnit(id: string) {
    if (id === unit) return
    onUnitChange(id)
    onAmountStrChange('')
  }

  return (
    <div className="item-qty-editor item-qty-editor-simple">
      <div className="unit-section">
        <span className="field-label" id={`${idPrefix}-unit-h`}>
          Birim
        </span>
        <div className="unit-scroll" role="tablist" aria-labelledby={`${idPrefix}-unit-h`}>
          {UNITS.map((u) => (
            <button
              key={u.id}
              type="button"
              role="tab"
              aria-selected={unit === u.id}
              className={unit === u.id ? 'unit-pill unit-pill-active' : 'unit-pill'}
              disabled={disabled}
              onClick={() => pickUnit(u.id)}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {unit ? (
        <div className="qty-inline-wrap">
          <label className="field qty-inline-field">
            <span className="field-label">Miktar ({unit})</span>
            <input
              id={`${idPrefix}-qty`}
              className="field-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="Örn. 2 veya 1,5"
              disabled={disabled}
              value={amountStr}
              onChange={(e) => onAmountStrChange(e.target.value)}
            />
          </label>
          <button type="button" className="btn ghost qty-inline-clear" disabled={disabled} onClick={onClearQty}>
            Birim ve miktarı kaldır
          </button>
        </div>
      ) : (
        <p className="qty-hint muted">İsterseniz bir birim seçip miktarı elle yazın; seçmezseniz yalnızca ürün adı kaydedilir.</p>
      )}
    </div>
  )
}
