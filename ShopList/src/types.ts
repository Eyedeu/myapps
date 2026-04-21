export type ListItem = {
  id: string
  text: string
  done: boolean
  order: number
  /** Varsa birlikte `unit` da vardır. */
  amount: number | null
  unit: string | null
}
