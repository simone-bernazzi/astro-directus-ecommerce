// src/pages/api/coupon/validate.ts
export const prerender = false

import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getCouponByCode } from '@/lib/directus'

const BodySchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0),
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

  const { code, subtotal } = parsed.data
  const coupon = await getCouponByCode(code).catch(() => null)

  if (!coupon || !coupon.is_active) {
    return new Response(JSON.stringify({ valid: false, error: 'Coupon non trovato o non attivo' }), { status: 200 })
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return new Response(JSON.stringify({ valid: false, error: 'Coupon scaduto' }), { status: 200 })
  }

  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return new Response(JSON.stringify({ valid: false, error: 'Coupon esaurito' }), { status: 200 })
  }

  if (coupon.min_order_amount !== null && subtotal < coupon.min_order_amount) {
    return new Response(JSON.stringify({
      valid: false,
      error: `Ordine minimo €${coupon.min_order_amount.toFixed(2)} richiesto`,
    }), { status: 200 })
  }

  return new Response(JSON.stringify({
    valid: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
