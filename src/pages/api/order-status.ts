// src/pages/api/order-status.ts — used by checkout/success page
export const prerender = false

import type { APIRoute } from 'astro'
import { getOrderBySessionId } from '@/lib/directus'

export const GET: APIRoute = async ({ url }) => {
  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400 })
  }

  const order = await getOrderBySessionId(sessionId).catch(() => null)
  return new Response(JSON.stringify({ order }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
