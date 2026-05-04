// src/pages/api/admin/notify-shipped.ts
// Protected endpoint — call from Directus flows or manually to mark an order as shipped and send tracking email.
// Required header: x-admin-key matching ADMIN_KEY env var.
// Body: { order_id: string, tracking_number?: string, tracking_url?: string }
export const prerender = false

import type { APIRoute } from 'astro'
import { createDirectus, rest, staticToken, readItem, updateItem } from '@directus/sdk'
import { sendShippingNotification, type EmailOrder } from '@/lib/email'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

function getDirectusClient() {
  return createDirectus<Schema>(process.env.DIRECTUS_URL!)
    .with(staticToken(process.env.DIRECTUS_TOKEN!))
    .with(rest())
}

export const POST: APIRoute = async ({ request }) => {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey || request.headers.get('x-admin-key') !== adminKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: { order_id?: string; tracking_number?: string; tracking_url?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { order_id, tracking_number, tracking_url } = body
  if (!order_id) {
    return new Response(JSON.stringify({ error: 'order_id is required' }), { status: 400 })
  }

  const directus = getDirectusClient()

  try {
    await directus.request(
      updateItem('orders', order_id, {
        status: 'shipped',
        ...(tracking_number !== undefined ? { tracking_number } : {}),
        ...(tracking_url !== undefined ? { tracking_url } : {}),
      })
    )

    const order = await directus.request(
      readItem('orders', order_id, {
        fields: ['id', 'customer_email', 'customer_name', 'subtotal', 'discount_amount',
          'shipping_cost', 'total', 'shipping_address', 'tracking_number', 'tracking_url'],
      })
    ) as Record<string, unknown>

    const emailOrder: EmailOrder = {
      id: order.id as string,
      customer_email: order.customer_email as string,
      customer_name: order.customer_name as string,
      subtotal: order.subtotal as number,
      discount_amount: order.discount_amount as number,
      shipping_cost: order.shipping_cost as number,
      total: order.total as number,
      shipping_address: order.shipping_address as EmailOrder['shipping_address'],
      tracking_number: (order.tracking_number as string | null) ?? tracking_number ?? null,
      tracking_url: (order.tracking_url as string | null) ?? tracking_url ?? null,
    }

    await sendShippingNotification(emailOrder)

    return new Response(JSON.stringify({ success: true, order_id }), { status: 200 })
  } catch (err) {
    console.error('[notify-shipped] error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
