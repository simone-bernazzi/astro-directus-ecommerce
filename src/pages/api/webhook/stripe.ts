// src/pages/api/webhook/stripe.ts
export const prerender = false

import type { APIRoute } from 'astro'
import Stripe from 'stripe'
import { createDirectus, rest, staticToken, createItem, createItems, updateItem, readItems } from '@directus/sdk'
import { randomUUID } from 'node:crypto'
import type { CartItem } from '@/lib/types'
import { sendOrderConfirmation, type EmailOrder } from '@/lib/email'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

function getDirectusClient() {
  return createDirectus<Schema>(process.env.DIRECTUS_URL!)
    .with(staticToken(process.env.DIRECTUS_TOKEN!))
    .with(rest())
}

export const POST: APIRoute = async ({ request }) => {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 503 })
  }
  const stripe = new Stripe(secretKey)

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret)
  } catch (err) {
    console.error('[webhook] signature verification failed:', err)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const directus = getDirectusClient()

  try {
    // Idempotency check
    const existing = await directus.request(
      readItems('orders', {
        filter: { stripe_session_id: { _eq: session.id } },
        limit: 1,
        fields: ['id'],
      })
    ) as Array<{ id: string }>

    if (existing.length > 0) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
    }

    // Parse items from payment_intent metadata
    const paymentIntent = typeof session.payment_intent === 'string'
      ? await stripe.paymentIntents.retrieve(session.payment_intent)
      : session.payment_intent
    const rawItems: Array<{ variantId: string; sku: string; qty: number }> =
      JSON.parse((paymentIntent as Stripe.PaymentIntent)?.metadata?.items ?? '[]')

    // Load variant details for snapshot + stock decrement
    const variantIds = rawItems.map(i => i.variantId)
    const variants = await directus.request(
      readItems('product_variants', {
        filter: { id: { _in: variantIds } },
        fields: ['id', 'sku', 'name', 'price_override', 'stock_quantity', 'product_id', 'digital_file.*',
          'download_limit', 'download_expires_hours', 'product_id.*'],
      })
    ) as Array<Record<string, unknown>>

    const shippingAddr = session.shipping_details?.address
    const shipping_address = shippingAddr ? {
      name: session.shipping_details?.name ?? '',
      line1: shippingAddr.line1 ?? '',
      line2: shippingAddr.line2 ?? null,
      city: shippingAddr.city ?? '',
      postal_code: shippingAddr.postal_code ?? '',
      state: shippingAddr.state ?? '',
      country: shippingAddr.country ?? '',
    } : null

    const subtotalCents = session.amount_subtotal ?? 0
    const totalCents = session.amount_total ?? 0
    const shippingCost = parseFloat(session.metadata?.shipping_cost ?? '0')
    const giftCardAmount = parseFloat(session.metadata?.gift_card_amount ?? '0')
    const discountAmount = Math.max(0, (subtotalCents - totalCents) / 100 - shippingCost + giftCardAmount)

    // Build order_items snapshots
    const orderItemsData = rawItems.map(ri => {
      const variant = variants.find(v => v.id === ri.variantId) ?? {}
      const product = variant.product_id as Record<string, unknown> ?? {}
      const hasDigitalFile = !!(variant.digital_file)
      const expiresAt = hasDigitalFile
        ? new Date(Date.now() + (variant.download_expires_hours as number ?? 168) * 3600 * 1000).toISOString()
        : null

      return {
        product_name: (product.name as string) ?? ri.sku,
        variant_name: (variant.name as string) ?? '',
        sku: ri.sku,
        unit_price: ((variant.price_override as number | null) ?? (product.base_price as number) ?? 0),
        quantity: ri.qty,
        download_token: hasDigitalFile ? randomUUID() : null,
        download_count: 0,
        download_limit: (variant.download_limit as number) ?? 3,
        download_expires_at: expiresAt,
      }
    })

    // Create order
    const order = await directus.request(
      createItem('orders', {
        stripe_session_id: session.id,
        status: 'paid',
        customer_email: session.customer_details?.email ?? '',
        customer_name: session.customer_details?.name ?? '',
        subtotal: subtotalCents / 100,
        discount_amount: discountAmount,
        shipping_cost: shippingCost,
        total: totalCents / 100,
        coupon_id: null,
        gift_card_id: null,
        gift_card_amount_used: giftCardAmount > 0 ? giftCardAmount : null,
        shipping_address,
        items: orderItemsData.map(i => ({
          product_name: i.product_name,
          variant_name: i.variant_name,
          sku: i.sku,
          unit_price: i.unit_price,
          quantity: i.quantity,
        })),
      })
    ) as { id: string }

    // Create order_items with FK to order
    await directus.request(
      createItems('order_items', orderItemsData.map(i => ({ ...i, order_id: order.id })))
    )

    // Send order confirmation email
    await sendOrderConfirmation(
      {
        id: order.id,
        customer_email: session.customer_details?.email ?? '',
        customer_name: session.customer_details?.name ?? '',
        subtotal: subtotalCents / 100,
        discount_amount: discountAmount,
        shipping_cost: shippingCost,
        total: totalCents / 100,
        shipping_address: shipping_address as EmailOrder['shipping_address'],
      },
      orderItemsData.map(i => ({
        product_name: i.product_name,
        variant_name: i.variant_name,
        sku: i.sku,
        unit_price: i.unit_price,
        quantity: i.quantity,
        download_token: i.download_token,
      }))
    )

    // Decrement stock
    for (const ri of rawItems) {
      const variant = variants.find(v => v.id === ri.variantId)
      if (variant) {
        const newStock = Math.max(0, (variant.stock_quantity as number) - ri.qty)
        await directus.request(
          updateItem('product_variants', ri.variantId, { stock_quantity: newStock })
        )
      }
    }

    // Update gift card balance if used
    const giftCardCode = session.metadata?.gift_card_code
    if (giftCardCode && giftCardAmount > 0) {
      const giftCards = await directus.request(
        readItems('gift_cards', {
          filter: { code: { _eq: giftCardCode } },
          limit: 1,
          fields: ['id', 'remaining_value', 'redemptions'],
        })
      ) as Array<Record<string, unknown>>
      if (giftCards[0]) {
        const gc = giftCards[0]
        const redemptions = Array.isArray(gc.redemptions) ? gc.redemptions : []
        await directus.request(
          updateItem('gift_cards', gc.id as string, {
            remaining_value: Math.max(0, (gc.remaining_value as number) - giftCardAmount),
            redemptions: [...redemptions, { date: new Date().toISOString(), amount: giftCardAmount, order_id: order.id }],
          })
        )
      }
    }

    return new Response(JSON.stringify({ received: true, orderId: order.id }), { status: 200 })
  } catch (err) {
    console.error('[webhook] processing error:', err)
    // Return 200 to prevent Stripe retry storms — log for manual recovery
    return new Response(JSON.stringify({ received: true, error: 'Processing failed' }), { status: 200 })
  }
}
