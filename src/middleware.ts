// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? ''

const COOKIE_OPTS = {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'lax' as const,
  path: '/',
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context

  const isAdminRoute = url.pathname.startsWith('/admin')
  const isLoginPage = url.pathname === '/admin/login'
  const isApiRoute = url.pathname.startsWith('/api/')

  if (!isAdminRoute || isLoginPage || isApiRoute) {
    return next()
  }

  const token = cookies.get('admin_token')?.value
  const refreshToken = cookies.get('admin_refresh')?.value

  if (token) {
    return next()
  }

  if (refreshToken && DIRECTUS_URL) {
    let res: Response
    try {
      res = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
      })
    } catch {
      const redirectTo = encodeURIComponent(url.pathname + url.search)
      return redirect(`/admin/login?redirect=${redirectTo}`)
    }

    if (res.ok) {
      const { data } = await res.json() as { data: { access_token: string; refresh_token: string } }
      cookies.set('admin_token', data.access_token, { ...COOKIE_OPTS, maxAge: 900 })
      cookies.set('admin_refresh', data.refresh_token, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
      return next()
    }
  }

  const redirectTo = encodeURIComponent(url.pathname + url.search)
  return redirect(`/admin/login?redirect=${redirectTo}`)
})
