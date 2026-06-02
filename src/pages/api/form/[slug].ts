// src/pages/api/form/[slug].ts
export const prerender = false

import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getForm, saveSubmission, containsBlockedKeyword, sendNotificationEmail } from '../../../lib/forms'
import { detectCountry, extractClientIp } from '../../../lib/geo'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const GET: APIRoute = async () => {
  return json(405, { error: 'Method Not Allowed' })
}

export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  // Step 1 — Load form config
  const { slug } = params
  if (!slug) return json(400, { error: 'Slug mancante' })
  const form = await getForm(slug)
  if (!form) return json(404, { error: 'Form non trovato' })

  // Step 2 — Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Body non valido' })
  }

  // Step 3 — Honeypot check (silent reject)
  if (form.honeypot_enabled) {
    const hp = body['_hp']
    if (typeof hp === 'string' && hp.length > 0) {
      return json(200, { success: true })
    }
  }

  // Step 4 — Country filter (also caches IP/country for later use)
  const clientIp = extractClientIp(request) || clientAddress || ''
  let cachedCountry: string | null = null
  if (form.country_filter_enabled && form.allowed_countries?.length) {
    cachedCountry = await detectCountry(request, clientIp)
    if (cachedCountry && !form.allowed_countries.includes(cachedCountry)) {
      return json(200, { success: true }) // silent reject
    }
  }

  // Step 5 — reCAPTCHA verification
  if (form.recaptcha_enabled) {
    const token = body['recaptchaToken']
    const secret = process.env.RECAPTCHA_SECRET_KEY
    if (!secret) {
      // reCAPTCHA enabled in form but not configured → skip (log warning)
      console.warn('[form] reCAPTCHA enabled but RECAPTCHA_SECRET_KEY not set')
    } else if (!token || typeof token !== 'string') {
      return json(400, { error: 'Verifica reCAPTCHA mancante' })
    } else {
      try {
        const searchParams = new URLSearchParams({ secret, response: token })
        const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: searchParams.toString(),
        })
        const data = await res.json() as { success: boolean; score?: number }
        const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE ?? '0.5')
        if (!data.success || (data.score !== undefined && data.score < minScore)) {
          return json(400, { error: 'Verifica reCAPTCHA fallita' })
        }
      } catch {
        console.error('[form] reCAPTCHA verification error — proceeding')
      }
    }
  }

  // Step 6 — Build field data object from form.fields (Zod validation)
  const fieldSchema: Record<string, z.ZodTypeAny> = {}
  for (const field of form.fields) {
    let schema: z.ZodTypeAny = z.string()
    if (field.type === 'email') schema = z.string().email()
    if (field.type === 'checkbox') schema = z.enum(['on', 'off'])
    if (!field.required) schema = schema.optional().default('')
    fieldSchema[field.name] = schema
  }
  const FormSchema = z.object(fieldSchema)
  const parsed = FormSchema.safeParse(
    Object.fromEntries(form.fields.map(f => [f.name, body[f.name]]))
  )
  if (!parsed.success) {
    return json(400, { error: 'Dati non validi', details: parsed.error.flatten() })
  }
  const fieldData: Record<string, unknown> = parsed.data

  // Step 7 — Keyword filter (silent reject)
  if (form.keyword_filter_enabled && form.blocked_keywords?.length) {
    if (containsBlockedKeyword(fieldData, form.blocked_keywords)) {
      return json(200, { success: true }) // silent reject
    }
  }

  // Step 8 — Save submission
  const rawPageUrl = typeof body['_page_url'] === 'string' ? body['_page_url'] : null
  let pageUrl: string | null = null
  if (rawPageUrl) {
    try {
      const u = new URL(rawPageUrl)
      if (u.protocol === 'https:' || u.protocol === 'http:') pageUrl = rawPageUrl
    } catch { /* invalid URL — discard */ }
  }
  const ip = form.capture_ip ? (clientIp || null) : null
  const ua = form.capture_user_agent ? (request.headers.get('user-agent') || null) : null
  let countryCode: string | null = null
  if (form.capture_ip && ip) {
    countryCode = cachedCountry ?? await detectCountry(request, ip)
  }
  await saveSubmission(form.id, {
    data: fieldData,
    page_url: form.capture_page_url ? pageUrl : null,
    ip_address: ip,
    user_agent: ua,
    country_code: countryCode,
  })

  // Step 9 — Send notification email
  if (form.notification_email) {
    try {
      await sendNotificationEmail({
        to: form.notification_email,
        formName: form.name,
        data: fieldData,
        pageUrl: form.capture_page_url ? pageUrl : null,
        country: countryCode,
        ipAddress: ip,
        userAgent: ua,
        submittedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[form] Email notification failed:', err)
    }
  }

  return json(200, { success: true })
}
