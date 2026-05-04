// src/pages/api/admin/auth.ts — sets/clears the admin session cookie
export const prerender = false

import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, cookies }) => {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) {
    return new Response(JSON.stringify({ error: 'ADMIN_KEY non configurata' }), { status: 503 })
  }

  let body: { password?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  if (body.password !== adminKey) {
    return new Response(JSON.stringify({ error: 'Password non valida' }), { status: 401 })
  }

  cookies.set('admin_session', adminKey, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete('admin_session', { path: '/' })
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
