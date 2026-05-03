// src/pages/api/order-status.ts — used by checkout/success page
export const prerender = false

import type { APIRoute } from 'astro'
import { getOrderBySessionId, getOrderById } from '@/lib/directus'

export const GET: APIRoute = async ({ url }) => {
  const sessionId = url.searchParams.get('session_id')
  const orderId   = url.searchParams.get('order_id')

  if (!sessionId && !orderId) {
    return new Response(JSON.stringify({ error: 'session_id or order_id required' }), { status: 400 })
  }

  const order = sessionId
    ? await getOrderBySessionId(sessionId).catch(() => null)
    : await getOrderById(orderId!).catch(() => null)

  return new Response(JSON.stringify({ order }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
