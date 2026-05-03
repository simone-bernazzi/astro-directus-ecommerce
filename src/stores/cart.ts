// src/stores/cart.ts
import { atom, computed } from 'nanostores'
import { persistentAtom } from '@nanostores/persistent'
import type { CartItem } from '@/lib/types'

export const cartItems = persistentAtom<CartItem[]>('cart', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
})

export const cartCount = computed(cartItems, items =>
  items.reduce((sum, item) => sum + item.quantity, 0)
)

export const cartSubtotal = computed(cartItems, items =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0)
)

export const cartWeightG = computed(cartItems, items =>
  items.reduce((sum, item) => sum + item.weightG * item.quantity, 0)
)

export function addToCart(item: CartItem): void {
  const current = cartItems.get()
  const existing = current.find(i => i.variantId === item.variantId)
  if (existing) {
    cartItems.set(
      current.map(i =>
        i.variantId === item.variantId
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
      )
    )
  } else {
    cartItems.set([...current, item])
  }
}

export function updateQuantity(variantId: string, quantity: number): void {
  if (quantity <= 0) {
    removeFromCart(variantId)
    return
  }
  cartItems.set(
    cartItems.get().map(i =>
      i.variantId === variantId ? { ...i, quantity } : i
    )
  )
}

export function removeFromCart(variantId: string): void {
  cartItems.set(cartItems.get().filter(i => i.variantId !== variantId))
}

export function clearCart(): void {
  cartItems.set([])
}

// Coupon / gift card state (session only — not persisted)
export const appliedCoupon = atom<{ code: string; type: 'percent' | 'fixed'; value: number } | null>(null)
export const appliedGiftCard = atom<{ code: string; id: string; amount: number } | null>(null)

export const cartDiscount = computed(
  [cartSubtotal, appliedCoupon, appliedGiftCard],
  (subtotal, coupon, giftCard) => {
    let discount = 0
    if (coupon) {
      discount += coupon.type === 'percent'
        ? subtotal * (coupon.value / 100)
        : coupon.value
    }
    if (giftCard) {
      discount += giftCard.amount
    }
    return Math.min(discount, subtotal)
  }
)
