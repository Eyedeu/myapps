export const UNITS = [
  { id: 'kg', label: 'kg' },
  { id: 'adet', label: 'adet' },
  { id: 'g', label: 'g' },
  { id: 'L', label: 'L' },
  { id: 'paket', label: 'paket' },
] as const

export type UnitId = (typeof UNITS)[number]['id']

/** Birime göre market alışverişinde sık kullanılan miktarlar. */
export const AMOUNT_PRESETS: Record<UnitId, number[]> = {
  kg: [0.25, 0.5, 1, 1.5, 2, 3, 5],
  adet: [1, 2, 3, 5, 6, 10, 12],
  g: [100, 150, 200, 250, 500, 1000],
  L: [0.5, 1, 1.5, 2, 3, 5],
  paket: [1, 2, 3, 4, 6],
}

export function presetsForUnit(unit: string): number[] {
  if ((UNITS as readonly { id: string }[]).some((u) => u.id === unit)) {
    return AMOUNT_PRESETS[unit as UnitId]
  }
  return [1, 2, 3, 5]
}

export function defaultAmountForUnit(unit: string): number {
  const p = presetsForUnit(unit)
  return p[0] ?? 1
}

export function stepAndMinForUnit(unit: string): { step: number; min: number } {
  switch (unit) {
    case 'kg':
      return { step: 0.25, min: 0.25 }
    case 'g':
      return { step: 50, min: 50 }
    case 'L':
      return { step: 0.25, min: 0.25 }
    case 'paket':
      return { step: 1, min: 1 }
    default:
      return { step: 1, min: 1 }
  }
}

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Number.isInteger(n)) return String(n)
  const t = Math.round(n * 100) / 100
  return String(t).replace(/\.?0+$/, '')
}

/** Miktar + birim çifti; yoksa boş nesne (yalnızca ürün adı). */
export function resolveQtyFields(
  amountStr: string,
  unit: string,
): { amount: number; unit: string } | Record<string, never> {
  const raw = amountStr.trim().replace(',', '.')
  const parsed = parseFloat(raw)
  let amount = !Number.isNaN(parsed) && parsed > 0 ? parsed : null
  const u = unit.trim()
  if (u && amount == null) amount = 1
  if (amount != null && !u) {
    return { amount, unit: 'adet' }
  }
  if (amount != null && u) {
    return { amount, unit: u }
  }
  return {}
}

export function amountToInputString(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return ''
  return formatAmount(amount)
}

export function parseItemQtyFromDoc(data: Record<string, unknown>): {
  amount: number | null
  unit: string | null
} {
  const a = data.amount
  const amount = typeof a === 'number' && Number.isFinite(a) && a > 0 ? a : null
  const u = data.unit
  const unit = typeof u === 'string' && u.trim() ? u.trim() : null
  return { amount, unit }
}

export function itemDisplayParts(
  text: string,
  amount: number | null,
  unit: string | null,
): { qty: string | null; name: string } {
  const t = text.trim() || 'Ürün'
  if (amount != null && unit) {
    return { qty: `${formatAmount(amount)} ${unit}`, name: t }
  }
  return { qty: null, name: t }
}

export function itemSpokenLabel(text: string, amount: number | null, unit: string | null): string {
  const { qty, name } = itemDisplayParts(text, amount, unit)
  return qty ? `${qty} ${name}` : name
}
