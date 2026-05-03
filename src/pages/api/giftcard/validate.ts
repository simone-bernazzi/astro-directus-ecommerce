// src/pages/api/giftcard/validate.ts
export const prerender = false

import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getGiftCardByCode } from '@/lib/directus'

const BodySchema = z.object({
  code: z.string().min(1),
})

export const POST: APIRoute = async ({ request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  const giftCard = await getGiftCardByCode(parsed.data.code).catch(() => null)

  if (!giftCard || !giftCard.is_active) {
    return new Response(JSON.stringify({ valid: false, error: 'Gift card non trovata o non attiva' }), { status: 200 })
  }

  if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
    return new Response(JSON.stringify({ valid: false, error: 'Gift card scaduta' }), { status: 200 })
  }

  if (giftCard.remaining_value <= 0) {
    return new Response(JSON.stringify({ valid: false, error: 'Saldo gift card esaurito' }), { status: 200 })
  }

  return new Response(JSON.stringify({
    valid: true,
    id: giftCard.id,
    code: giftCard.code,
    remaining_value: giftCard.remaining_value,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
