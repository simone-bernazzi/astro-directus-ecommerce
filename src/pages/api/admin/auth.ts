// Admin auth: login (POST), logout (DELETE)
// Login verifica le credenziali Directus, poi salva il token statico nel cookie (non scade mai).
export const prerender = false

import type { APIRoute } from 'astro'

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? ''
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? ''

const COOKIE_OPTS = {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax' as const,
  path: '/',
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
    return new Response(JSON.stringify({ error: 'DIRECTUS_URL o DIRECTUS_TOKEN non configurati' }), { status: 503 })
  }

  let body: { email?: string; password?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  if (!body.email || !body.password) {
    return new Response(JSON.stringify({ error: 'Email e password obbligatorie' }), { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Servizio non raggiungibile' }), { status: 503 })
  }

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Credenziali non valide' }), { status: 401 })
  }

  // Credenziali ok: salva il token statico (non scade) invece del JWT
  cookies.set('admin_token', DIRECTUS_TOKEN, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 30 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete('admin_token', { path: '/' })
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
