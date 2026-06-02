// Admin JWT auth: login (POST), logout (DELETE), token refresh (PATCH)
export const prerender = false

import type { APIRoute } from 'astro'

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? ''

const COOKIE_OPTS = {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax' as const,
  path: '/',
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!DIRECTUS_URL) {
    return new Response(JSON.stringify({ error: 'DIRECTUS_URL non configurata' }), { status: 503 })
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

  const { data } = await res.json() as { data: { access_token: string; refresh_token: string } }

  cookies.set('admin_token', data.access_token, { ...COOKIE_OPTS, maxAge: 900 })
  cookies.set('admin_refresh', data.refresh_token, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

export const DELETE: APIRoute = async ({ cookies, url }) => {
  if (cookies.get('admin_token')?.value && url) {
    await fetch(`${DIRECTUS_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: cookies.get('admin_refresh')?.value }),
    }).catch(() => {})
  }

  cookies.delete('admin_token', { path: '/' })
  cookies.delete('admin_refresh', { path: '/' })
  cookies.delete('admin_session', { path: '/' })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

export const PATCH: APIRoute = async ({ cookies }) => {
  const refreshToken = cookies.get('admin_refresh')?.value

  if (!refreshToken || !DIRECTUS_URL) {
    return new Response(JSON.stringify({ error: 'Nessun token di refresh' }), { status: 401 })
  }

  let res: Response
  try {
    res = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Servizio non raggiungibile' }), { status: 503 })
  }

  if (!res.ok) {
    cookies.delete('admin_token', { path: '/' })
    cookies.delete('admin_refresh', { path: '/' })
    return new Response(JSON.stringify({ error: 'Refresh fallito' }), { status: 401 })
  }

  const { data } = await res.json() as { data: { access_token: string; refresh_token: string } }

  cookies.set('admin_token', data.access_token, { ...COOKIE_OPTS, maxAge: 900 })
  cookies.set('admin_refresh', data.refresh_token, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
