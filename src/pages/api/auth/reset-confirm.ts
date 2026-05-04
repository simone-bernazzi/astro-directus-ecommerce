// src/pages/api/auth/reset-confirm.ts — validates Directus reset token and sets new password
export const prerender = false

import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string; password?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  const { token, password } = body
  if (!token || !password) {
    return new Response(JSON.stringify({ error: 'Token e password sono obbligatori' }), { status: 400 })
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'La password deve essere di almeno 8 caratteri' }), { status: 400 })
  }

  const directusUrl = process.env.DIRECTUS_URL
  if (!directusUrl) {
    return new Response(JSON.stringify({ error: 'Servizio non disponibile' }), { status: 503 })
  }

  try {
    const res = await fetch(`${directusUrl}/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { errors?: Array<{ message: string }> }
      const msg = data.errors?.[0]?.message ?? 'Token non valido o scaduto'
      return new Response(JSON.stringify({ error: msg }), { status: 400 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ error: 'Errore durante il reset. Riprova.' }), { status: 500 })
  }
}
