// src/pages/api/admin/auth.ts
export const prerender = false

import type { APIRoute } from 'astro'

const DIRECTUS_URL = () => process.env.DIRECTUS_URL ?? ''

export const POST: APIRoute = async ({ request, cookies }) => {
  const url = DIRECTUS_URL()
  if (!url) {
    return new Response(JSON.stringify({ error: 'DIRECTUS_URL non configurata' }), { status: 503 })
  }

  let body: { email?: string; password?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  if (!body.email || !body.password) {
    return new Response(JSON.stringify({ error: 'Email e password obbligatorie' }), { status: 400 })
  }

  const res = await fetch(`${url}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Credenziali non valide' }), { status: 401 })
  }

  const { data } = await res.json() as { data: { access_token: string; refresh_token: string; expires: number } }

  const cookieOpts = {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    path: '/',
  }

  cookies.set('admin_token', data.access_token, { ...cookieOpts, maxAge: 900 })
  cookies.set('admin_refresh', data.refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

export const DELETE: APIRoute = async ({ cookies }) => {
  const token = cookies.get('admin_token')?.value
  const url = DIRECTUS_URL()

  if (token && url) {
    await fetch(`${url}/auth/logout`, {
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
  const url = DIRECTUS_URL()

  if (!refreshToken || !url) {
    return new Response(JSON.stringify({ error: 'No refresh token' }), { status: 401 })
  }

  const res = await fetch(`${url}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
  })

  if (!res.ok) {
    cookies.delete('admin_token', { path: '/' })
    cookies.delete('admin_refresh', { path: '/' })
    return new Response(JSON.stringify({ error: 'Refresh fallito' }), { status: 401 })
  }

  const { data } = await res.json() as { data: { access_token: string; refresh_token: string } }

  const cookieOpts = {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    path: '/',
  }

  cookies.set('admin_token', data.access_token, { ...cookieOpts, maxAge: 900 })
  cookies.set('admin_refresh', data.refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
