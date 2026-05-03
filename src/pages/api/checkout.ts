// src/pages/api/checkout.ts
export const prerender = false

import type { APIRoute } from 'astro'
import Stripe from 'stripe'
import { z } from 'zod'
import { createDirectus, rest, staticToken, createItem, createItems, updateItem, readItems } from '@directus/sdk'
import { randomUUID } from 'node:crypto'
import { getProducts, getCouponByCode, getGiftCardByCode, getShippingZones } from '@/lib/directus'
import type { CartItem, ShippingZone } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

function getDirectusClient() {
  return createDirectus<Schema>(process.env.DIRECTUS_URL!)
    .with(staticToken(process.env.DIRECTUS_TOKEN!))
    .with(rest())
}

const CartItemSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  image: z.string().nullable(),
  type: z.enum(['physical', 'digital']),
  weightG: z.number().int().min(0),
})

const BodySchema = z.object({
  items: z.array(CartItemSchema).min(1),
  couponCode: z.string().nullable().optional(),
  giftCardCode: z.string().nullable().optional(),
  shippingCountry: z.string().length(2).optional(),
})

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

function calcShipping(items: CartItem[], zone: ShippingZone | null, subtotal: number): number {
  if (!zone) return 0
  if (zone.free_shipping_threshold && subtotal >= zone.free_shipping_threshold) return 0
  const totalWeightKg = items.reduce((sum, i) => sum + (i.weightG * i.quantity), 0) / 1000
  return zone.base_rate + (zone.rate_per_kg * Math.max(0, totalWeightKg - 1))
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin') ?? ''
  const allowed = process.env.ALLOWED_ORIGIN ?? ''
  if (allowed && origin !== allowed) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }), { status: 400 })
  }

  const { items, couponCode, giftCardCode, shippingCountry } = parsed.data

  try {
    // Re-read prices from Directus (never trust client prices)
    const products = await getProducts()
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let subtotal = 0

    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        return new Response(JSON.stringify({ error: `Prodotto non trovato: ${item.productName}` }), { status: 400 })
      }
      const variant = product.variants?.find(v => v.id === item.variantId && v.is_active)
      if (!variant) {
        return new Response(JSON.stringify({ error: `Variante non trovata: ${item.variantName}` }), { status: 400 })
      }
      if (variant.stock_quantity < item.quantity) {
        return new Response(JSON.stringify({ error: `Stock insufficiente per: ${item.productName}` }), { status: 400 })
      }

      const serverPrice = variant.price_override ?? product.base_price
      subtotal += serverPrice * item.quantity

      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${product.name}${variant.name !== product.name ? ` — ${variant.name}` : ''}`,
            metadata: { productId: product.id, variantId: variant.id, sku: variant.sku },
          },
          unit_amount: Math.round(serverPrice * 100),
        },
        quantity: item.quantity,
      })
    }

    // Shipping
    const zones = await getShippingZones()
    let shippingZone: ShippingZone | null = null
    if (shippingCountry) {
      shippingZone = zones.find(z => z.countries.includes(shippingCountry)) ?? null
    }
    const hasPhysical = items.some(i => i.type === 'physical')
    const shippingCost = hasPhysical ? calcShipping(items, shippingZone, subtotal) : 0

    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Spedizione' },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      })
    }

    // Coupon
    let stripeCoupon: string | undefined
    let discountAmount = 0
    if (couponCode) {
      const coupon = await getCouponByCode(couponCode)
      if (coupon && coupon.is_active) {
        if (!coupon.min_order_amount || subtotal >= coupon.min_order_amount) {
          discountAmount = coupon.type === 'percent'
            ? subtotal * (coupon.value / 100)
            : coupon.value
          if (coupon.stripe_coupon_id) {
            stripeCoupon = coupon.stripe_coupon_id
          }
        }
      }
    }

    // Gift card (as a discount line item — Stripe doesn't have native gift card deduction)
    let giftCardAmount = 0
    if (giftCardCode) {
      const giftCard = await getGiftCardByCode(giftCardCode)
      if (giftCard && giftCard.is_active && giftCard.remaining_value > 0) {
        giftCardAmount = Math.min(giftCard.remaining_value, subtotal - discountAmount)
        if (giftCardAmount > 0) {
          lineItems.push({
            price_data: {
              currency: 'eur',
              product_data: { name: `Gift card (${giftCardCode})` },
              unit_amount: -Math.round(giftCardAmount * 100),
            },
            quantity: 1,
          })
        }
      }
    }

    const totalCents = Math.round((subtotal + shippingCost - discountAmount - giftCardAmount) * 100)
    const siteUrl = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321'

    // Free order — total < €0.50: bypass Stripe and create order directly
    if (totalCents < 50) {
      const directus = getDirectusClient()

      // Load variant details for stock decrement + digital file tokens
      const variantIds = items.map(i => i.variantId)
      const variants = await directus.request(
        readItems('product_variants', {
          filter: { id: { _in: variantIds } },
          fields: ['id', 'sku', 'name', 'price_override', 'stock_quantity', 'product_id',
            'digital_file', 'download_limit', 'download_expires_hours', 'product_id.*'],
        })
      ) as Array<Record<string, unknown>>

      const orderItemsData = items.map(item => {
        const variant = variants.find(v => v.id === item.variantId) ?? {}
        const hasDigitalFile = !!(variant.digital_file)
        const expiresAt = hasDigitalFile
          ? new Date(Date.now() + ((variant.download_expires_hours as number) ?? 168) * 3600 * 1000).toISOString()
          : null
        return {
          product_name: item.productName,
          variant_name: item.variantName,
          sku: item.sku,
          unit_price: item.price,
          quantity: item.quantity,
          download_token: hasDigitalFile ? randomUUID() : null,
          download_count: 0,
          download_limit: (variant.download_limit as number) ?? 3,
          download_expires_at: expiresAt,
        }
      })

      const freeOrder = await directus.request(
        createItem('orders', {
          stripe_session_id: null,
          status: 'paid',
          customer_email: '',
          customer_name: '',
          subtotal,
          discount_amount: discountAmount + giftCardAmount,
          shipping_cost: shippingCost,
          total: Math.max(0, totalCents / 100),
          coupon_id: null,
          gift_card_id: null,
          gift_card_amount_used: giftCardAmount > 0 ? giftCardAmount : null,
          shipping_address: null,
          items: orderItemsData.map(i => ({
            product_name: i.product_name, variant_name: i.variant_name,
            sku: i.sku, unit_price: i.unit_price, quantity: i.quantity,
          })),
        })
      ) as { id: string }

      await directus.request(
        createItems('order_items', orderItemsData.map(i => ({ ...i, order_id: freeOrder.id })))
      )

      // Decrement stock
      for (const item of items) {
        const variant = variants.find(v => v.id === item.variantId)
        if (variant) {
          const newStock = Math.max(0, (variant.stock_quantity as number) - item.quantity)
          await directus.request(updateItem('product_variants', item.variantId, { stock_quantity: newStock }))
        }
      }

      // Update gift card balance
      if (giftCardCode && giftCardAmount > 0) {
        const giftCards = await directus.request(
          readItems('gift_cards', { filter: { code: { _eq: giftCardCode } }, limit: 1, fields: ['id', 'remaining_value', 'redemptions'] })
        ) as Array<Record<string, unknown>>
        if (giftCards[0]) {
          const gc = giftCards[0]
          const redemptions = Array.isArray(gc.redemptions) ? gc.redemptions : []
          await directus.request(updateItem('gift_cards', gc.id as string, {
            remaining_value: Math.max(0, (gc.remaining_value as number) - giftCardAmount),
            redemptions: [...redemptions, { date: new Date().toISOString(), amount: giftCardAmount, order_id: freeOrder.id }],
          }))
        }
      }

      return new Response(JSON.stringify({ url: `${siteUrl}/checkout/success?order_id=${freeOrder.id}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      ...(stripeCoupon ? { discounts: [{ coupon: stripeCoupon }] } : {}),
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      metadata: {
        coupon_code: couponCode ?? '',
        gift_card_code: giftCardCode ?? '',
        gift_card_amount: String(giftCardAmount),
        shipping_cost: String(shippingCost),
      },
      shipping_address_collection: hasPhysical
        ? { allowed_countries: zones.flatMap(z => z.countries) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] }
        : undefined,
      payment_intent_data: {
        metadata: {
          items: JSON.stringify(items.map(i => ({ variantId: i.variantId, sku: i.sku, qty: i.quantity }))),
        },
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[checkout]', err)
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), { status: 500 })
  }
}
