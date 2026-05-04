// src/stores/compare.ts
import { persistentAtom } from '@nanostores/persistent'

export interface CompareItem {
  id: string
  slug: string
  name: string
  imageUrl: string | null
  price: number
  comparePrice: number | null
  category: string | null
  type: string
  isOutOfStock: boolean
  weightG: number
}

export const compareItems = persistentAtom<CompareItem[]>('compare', [], {
  encode: JSON.stringify,
  decode: (v) => { try { return JSON.parse(v) } catch { return [] } },
})

export const MAX_COMPARE = 3

export function addToCompare(item: CompareItem): boolean {
  const current = compareItems.get()
  if (current.length >= MAX_COMPARE || current.some(i => i.id === item.id)) return false
  compareItems.set([...current, item])
  return true
}

export function removeFromCompare(id: string) {
  compareItems.set(compareItems.get().filter(i => i.id !== id))
}

export function clearCompare() {
  compareItems.set([])
}

export function isInCompare(id: string): boolean {
  return compareItems.get().some(i => i.id === id)
}
