// src/stores/wishlist.ts
import { persistentAtom } from '@nanostores/persistent'
import { computed } from 'nanostores'

export interface WishlistItem {
  productId: string
  productSlug: string
  productName: string
  price: number
  image: string | null
  categoryName: string
}

export const wishlistItems = persistentAtom<WishlistItem[]>('wishlist', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
})

export const wishlistCount = computed(wishlistItems, items => items.length)

export function toggleWishlist(item: WishlistItem): void {
  const current = wishlistItems.get()
  const exists = current.some(i => i.productId === item.productId)
  wishlistItems.set(
    exists
      ? current.filter(i => i.productId !== item.productId)
      : [...current, item]
  )
}

export function removeFromWishlist(productId: string): void {
  wishlistItems.set(wishlistItems.get().filter(i => i.productId !== productId))
}

export function isInWishlist(productId: string): boolean {
  return wishlistItems.get().some(i => i.productId === productId)
}
