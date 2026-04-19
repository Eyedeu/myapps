/** Yeni liste için varsayılan başlık (yerel tarih). */
export function defaultListTitle(): string {
  const d = new Date()
  return `Alışveriş · ${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`
}
