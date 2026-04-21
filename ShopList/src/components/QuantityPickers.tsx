import { UNITS } from '../itemQty'

type Props = {
  amountStr: string
  unit: string
  onAmountStrChange: (v: string) => void
  onUnitChange: (unitId: string) => void
  onQuickAmount: (n: number) => void
  onClearQty: () => void
  disabled?: boolean
  idPrefix: string
}

export function QuantityPickers({
  amountStr,
  unit,
  onAmountStrChange,
  onUnitChange,
  onQuickAmount,
  onClearQty,
  disabled,
  idPrefix,
}: Props) {
  return (
    <div className="qty-pickers">
      <div className="qty-block">
        <span className="field-label" id={`${idPrefix}-qty-label`}>
          Miktar
        </span>
        <div className="qty-quick" role="group" aria-labelledby={`${idPrefix}-qty-label`}>
          {[1, 2, 3, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="chip"
              disabled={disabled}
              onClick={() => onQuickAmount(n)}
            >
              {n}
            </button>
          ))}
          <button type="button" className="chip" disabled={disabled} onClick={() => onQuickAmount(0.5)}>
            ½
          </button>
          <button
            type="button"
            className="chip chip-ghost"
            disabled={disabled}
            title="Miktar kullanma"
            onClick={onClearQty}
          >
            —
          </button>
        </div>
        <input
          id={`${idPrefix}-qty-input`}
          className="field-input qty-manual"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="Elle yazın (örn. 1,5)"
          disabled={disabled}
          value={amountStr}
          onChange={(e) => onAmountStrChange(e.target.value)}
          aria-label="Miktar — elle"
        />
      </div>
      <div className="unit-block">
        <span className="field-label" id={`${idPrefix}-unit-label`}>
          Birim
        </span>
        <div className="unit-chips" role="group" aria-labelledby={`${idPrefix}-unit-label`}>
          {UNITS.map((u) => (
            <button
              key={u.id}
              type="button"
              className={unit === u.id ? 'chip chip-active' : 'chip'}
              disabled={disabled}
              onClick={() => {
                onUnitChange(u.id)
                if (!amountStr.trim()) onAmountStrChange('1')
              }}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
