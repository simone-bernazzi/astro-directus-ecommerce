// src/pages/api/stock-notify.ts
export const prerender = false

import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createDirectus, rest, staticToken, createItem, readItems } from '@directus/sdk'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

const BodySchema = z.object({
  email: z.string().email().max(254),
  product_id: z.string().min(1),
  variant_id: z.string().nullable().optional(),
})

export const POST: APIRoute = async ({ request }) => {
  let body: unknown
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Dati non validi' }), { status: 400 })
  }

  const { email, product_id, variant_id } = parsed.data

  const directusUrl = process.env.DIRECTUS_URL
  const directusToken = process.env.DIRECTUS_TOKEN
  if (!directusUrl || !directusToken) {
    return new Response(JSON.stringify({ error: 'Servizio non disponibile' }), { status: 503 })
  }

  const directus = createDirectus<Schema>(directusUrl).with(staticToken(directusToken)).with(rest())

  // Duplicate check — same email + product (+ optional variant) already waiting
  const existing = await directus.request(
    readItems('stock_notifications', {
      filter: {
        email: { _eq: email },
        product_id: { _eq: product_id },
        notified_at: { _null: true },
        ...(variant_id ? { variant_id: { _eq: variant_id } } : {}),
      },
      limit: 1,
      fields: ['id'],
    })
  ) as Array<{ id: string }>

  if (existing.length > 0) {
    return new Response(JSON.stringify({ success: true, duplicate: true }), { status: 200 })
  }

  await directus.request(
    createItem('stock_notifications', {
      email,
      product_id,
      variant_id: variant_id ?? null,
      notified_at: null,
    })
  )

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
