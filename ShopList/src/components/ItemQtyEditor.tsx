import {
  UNITS,
  defaultAmountForUnit,
  formatAmount,
  presetsForUnit,
  stepAndMinForUnit,
} from '../itemQty'

type Props = {
  amountStr: string
  unit: string
  onAmountStrChange: (v: string) => void
  onUnitChange: (u: string) => void
  onClearQty: () => void
  disabled?: boolean
  idPrefix: string
}

function parseAmount(s: string): number | null {
  const raw = s.trim().replace(',', '.')
  const n = parseFloat(raw)
  return !Number.isNaN(n) && n > 0 ? n : null
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001 || Math.round(a) === Math.round(b)
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
    onAmountStrChange(String(defaultAmountForUnit(id)))
  }

  function adjustStep(dir: -1 | 1) {
    if (!unit || disabled) return
    const { step, min } = stepAndMinForUnit(unit)
    let cur = parseAmount(amountStr) ?? min
    if (cur < min) cur = min
    let next = cur + dir * step
    next = Math.max(min, next)
    if (unit === 'g') {
      next = Math.round(next / 50) * 50
      next = Math.max(min, next)
    } else {
      next = Math.round(next * 1000) / 1000
    }
    onAmountStrChange(formatAmount(next))
  }

  const parsed = parseAmount(amountStr)
  const presets = unit ? presetsForUnit(unit) : []

  return (
    <div className="item-qty-editor">
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
        {!unit && (
          <p className="qty-hint muted">İsterseniz bir birim seçin; seçince aşağıda miktar ve bu birime uygun hızlı değerler görünür.</p>
        )}
      </div>

      {unit ? (
        <div className="qty-card">
          <div className="qty-card-head">
            <span className="qty-card-title">Miktar</span>
            <button type="button" className="qty-link-clear" disabled={disabled} onClick={onClearQty}>
              Miktarı kaldır
            </button>
          </div>
          <div className="qty-stepper">
            <button
              type="button"
              className="qty-step-btn"
              disabled={disabled}
              aria-label="Miktarı azalt"
              onClick={() => adjustStep(-1)}
            >
              −
            </button>
            <div className="qty-step-center">
              <span className="qty-step-number">{parsed != null ? formatAmount(parsed) : '—'}</span>
              <span className="qty-step-unit-label">{unit}</span>
            </div>
            <button
              type="button"
              className="qty-step-btn"
              disabled={disabled}
              aria-label="Miktarı arttır"
              onClick={() => adjustStep(1)}
            >
              +
            </button>
          </div>
          <span className="preset-caption">Hızlı seçim</span>
          <div className="preset-grid">
            {presets.map((n) => {
              const active = parsed != null && amountsClose(parsed, n)
              return (
                <button
                  key={n}
                  type="button"
                  className={active ? 'preset-tile preset-tile-active' : 'preset-tile'}
                  disabled={disabled}
                  onClick={() => onAmountStrChange(formatAmount(n))}
                >
                  {formatAmount(n)}
                </button>
              )
            })}
          </div>
          <label className="qty-exact">
            <span className="field-label">Elle değer</span>
            <input
              id={`${idPrefix}-exact`}
              className="field-input qty-exact-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="Örn. 1,25"
              disabled={disabled}
              value={amountStr}
              onChange={(e) => onAmountStrChange(e.target.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
