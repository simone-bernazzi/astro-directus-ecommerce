// src/pages/api/admin/notify-restock.ts
// Protected endpoint — sends restock notification emails to all subscribers of a product/variant.
// Call from Directus Flows when stock is replenished, or manually via cURL.
// Required header: x-admin-key matching ADMIN_KEY env var.
// Body: { product_id: string, variant_id?: string, product_name: string }
export const prerender = false

import type { APIRoute } from 'astro'
import { createDirectus, rest, staticToken, readItems, updateItems, readItem } from '@directus/sdk'
import { sendRestockNotification } from '@/lib/email'

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

  let body: { product_id?: string; variant_id?: string; product_name?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { product_id, variant_id, product_name } = body
  if (!product_id) {
    return new Response(JSON.stringify({ error: 'product_id is required' }), { status: 400 })
  }

  const directus = getDirectusClient()

  // Fetch pending notifications for this product (optionally scoped to a variant)
  const filter: Record<string, unknown> = {
    product_id: { _eq: product_id },
    notified_at: { _null: true },
  }
  if (variant_id) filter.variant_id = { _eq: variant_id }

  const notifications = await directus.request(
    readItems('stock_notifications', {
      filter,
      fields: ['id', 'email'],
    })
  ) as Array<{ id: string; email: string }>

  if (notifications.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), { status: 200 })
  }

  // Resolve product name if not provided
  let resolvedName = product_name
  if (!resolvedName) {
    try {
      const product = await directus.request(readItem('products', product_id, { fields: ['name'] })) as { name: string }
      resolvedName = product.name
    } catch {
      resolvedName = 'Prodotto'
    }
  }

  const siteUrl = process.env.PUBLIC_SITE_URL ?? ''
  const productSlug = await (async () => {
    try {
      const product = await directus.request(readItem('products', product_id, { fields: ['slug'] })) as { slug: string }
      return product.slug
    } catch { return '' }
  })()

  const productUrl = `${siteUrl}/negozio/${productSlug}`

  // Send emails
  let sent = 0
  for (const n of notifications) {
    await sendRestockNotification(n.email, resolvedName!, productUrl)
    sent++
  }

  // Mark as notified
  const notifiedAt = new Date().toISOString()
  await directus.request(
    updateItems('stock_notifications', {
      keys: notifications.map(n => n.id),
      data: { notified_at: notifiedAt },
    })
  )

  return new Response(JSON.stringify({ success: true, sent }), { status: 200 })
}
