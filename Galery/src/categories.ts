export type Category = { id: string; label: string }

export const CATEGORIES: Category[] = [
  { id: 'family', label: 'Aile' },
  { id: 'work', label: 'İş' },
  { id: 'travel', label: 'Gezi' },
  { id: 'friends', label: 'Arkadaşlar' },
  { id: 'other', label: 'Diğer' },
]

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id
}
