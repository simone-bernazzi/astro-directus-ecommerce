// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context

  const isAdminRoute = url.pathname.startsWith('/admin')
  const isLoginPage = url.pathname === '/admin/login'
  const isApiRoute = url.pathname.startsWith('/api/')

  if (!isAdminRoute || isLoginPage || isApiRoute) {
    return next()
  }

  if (cookies.get('admin_token')?.value) {
    return next()
  }

  const redirectTo = encodeURIComponent(url.pathname + url.search)
  return redirect(`/admin/login?redirect=${redirectTo}`)
})
