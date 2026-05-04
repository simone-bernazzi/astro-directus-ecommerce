// src/pages/api/auth/login.ts
export const prerender = false

import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { email?: string; password?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  const { email, password } = body
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email e password sono obbligatorie' }), { status: 400 })
  }

  const directusUrl = process.env.DIRECTUS_URL
  if (!directusUrl) {
    return new Response(JSON.stringify({ error: 'Servizio non disponibile' }), { status: 503 })
  }

  try {
    const res = await fetch(`${directusUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json() as {
      data?: { access_token: string; refresh_token: string; expires: number }
      errors?: Array<{ message: string }>
    }

    if (!res.ok || !data.data?.access_token) {
      const msg = data.errors?.[0]?.message ?? 'Credenziali non valide'
      return new Response(JSON.stringify({ error: msg }), { status: 401 })
    }

    const { access_token, refresh_token, expires } = data.data
    const maxAge = Math.floor(expires / 1000)

    cookies.set('directus_token', access_token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
    cookies.set('directus_refresh_token', refresh_token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ error: 'Errore durante il login. Riprova.' }), { status: 500 })
  }
}
