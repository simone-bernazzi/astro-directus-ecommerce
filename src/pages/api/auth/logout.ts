// src/pages/api/auth/logout.ts
export const prerender = false

import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ cookies }) => {
  const refreshToken = cookies.get('directus_refresh_token')?.value
  const directusUrl = process.env.DIRECTUS_URL

  if (refreshToken && directusUrl) {
    await fetch(`${directusUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => { /* best-effort */ })
  }

  cookies.delete('directus_token', { path: '/' })
  cookies.delete('directus_refresh_token', { path: '/' })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
