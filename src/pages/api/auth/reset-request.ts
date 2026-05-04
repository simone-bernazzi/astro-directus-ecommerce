// src/pages/api/auth/reset-request.ts — triggers Directus password reset email
export const prerender = false

import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  const { email } = body
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email obbligatoria' }), { status: 400 })
  }

  const directusUrl = process.env.DIRECTUS_URL
  const siteUrl = process.env.PUBLIC_SITE_URL ?? ''

  if (!directusUrl) {
    return new Response(JSON.stringify({ error: 'Servizio non disponibile' }), { status: 503 })
  }

  try {
    // Directus sends the reset email with a link to reset_url?token=<token>
    await fetch(`${directusUrl}/auth/password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        reset_url: `${siteUrl}/account/recupera-password`,
      }),
    })
    // Always return success to avoid email enumeration
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ error: 'Errore durante l\'invio. Riprova.' }), { status: 500 })
  }
}
