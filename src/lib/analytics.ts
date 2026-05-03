// src/lib/analytics.ts
// Typed wrapper around window.dataLayer for GA4 ecommerce events via GTM.
// All pushes are no-ops when GTM is not configured.

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

export function pushEvent(event: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event, ...payload })
}

// ── GA4 item shape ────────────────────────────────────────────────────────────

export interface AnalyticsItem {
  item_id: string
  item_name: string
  item_category?: string
  item_variant?: string
  price: number
  quantity?: number
  index?: number
}

// ── Ecommerce events ──────────────────────────────────────────────────────────

export function trackViewItemList(listName: string, items: AnalyticsItem[]): void {
  pushEvent('view_item_list', {
    ecommerce: { item_list_name: listName, items },
  })
}

export function trackSelectItem(listName: string, item: AnalyticsItem): void {
  pushEvent('select_item', {
    ecommerce: { item_list_name: listName, items: [item] },
  })
}

export function trackViewItem(item: AnalyticsItem): void {
  pushEvent('view_item', {
    ecommerce: { currency: 'EUR', value: item.price, items: [item] },
  })
}

export function trackAddToCart(item: AnalyticsItem): void {
  pushEvent('add_to_cart', {
    ecommerce: { currency: 'EUR', value: item.price * (item.quantity ?? 1), items: [item] },
  })
}

export function trackRemoveFromCart(item: AnalyticsItem): void {
  pushEvent('remove_from_cart', {
    ecommerce: { currency: 'EUR', value: item.price * (item.quantity ?? 1), items: [item] },
  })
}

export function trackViewCart(items: AnalyticsItem[], value: number): void {
  pushEvent('view_cart', {
    ecommerce: { currency: 'EUR', value, items },
  })
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number, coupon?: string): void {
  pushEvent('begin_checkout', {
    ecommerce: { currency: 'EUR', value, coupon, items },
  })
}

export function trackPurchase(
  transactionId: string,
  value: number,
  items: AnalyticsItem[],
  coupon?: string,
): void {
  pushEvent('purchase', {
    ecommerce: {
      transaction_id: transactionId,
      currency: 'EUR',
      value,
      coupon,
      items,
    },
  })
}

export function trackApplyCoupon(code: string, discount: number): void {
  pushEvent('apply_coupon', { coupon_code: code, discount_value: discount })
}

export function trackFormSubmit(formName: string): void {
  pushEvent('form_submit', { form_name: formName })
}
