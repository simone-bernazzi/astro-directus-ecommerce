// src/pages/api/contact.ts
export const prerender = false

import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createDirectus, rest, staticToken, createItem } from '@directus/sdk'

const BodySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  phone: z.string().max(30).optional().default(''),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  recaptchaToken: z.string().nullable().optional(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

async function verifyRecaptcha(token: string, remoteIp?: string): Promise<{ success: boolean; score: number; action: string }> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) return { success: true, score: 1, action: 'contact_form' }

  const params = new URLSearchParams({ secret, response: token })
  if (remoteIp) params.set('remoteip', remoteIp)

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const data = await res.json() as { success: boolean; score: number; action: string }
  return data
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Dati non validi', details: parsed.error.flatten() }), { status: 400 })
  }

  const { name, email, phone, subject, message, recaptchaToken } = parsed.data

  // reCAPTCHA v3 verification
  const siteKeyConfigured = !!process.env.RECAPTCHA_SECRET_KEY
  if (siteKeyConfigured) {
    if (!recaptchaToken) {
      return new Response(JSON.stringify({ error: 'Verifica reCAPTCHA mancante. Ricarica la pagina e riprova.' }), { status: 400 })
    }
    try {
      const result = await verifyRecaptcha(recaptchaToken, clientAddress)
      const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE ?? '0.5')

      if (!result.success) {
        return new Response(JSON.stringify({ error: 'Verifica reCAPTCHA fallita. Riprova.' }), { status: 400 })
      }
      if (result.score < minScore) {
        return new Response(JSON.stringify({ error: 'Attività sospetta rilevata. Impossibile inviare il messaggio.' }), { status: 400 })
      }
    } catch {
      // If reCAPTCHA service is unreachable, log and continue (don't block legitimate users)
      console.error('[contact] reCAPTCHA verification failed — proceeding without score check')
    }
  }

  // Save to Directus
  const directusUrl = process.env.DIRECTUS_URL
  const directusToken = process.env.DIRECTUS_TOKEN

  if (directusUrl && directusToken) {
    try {
      const directus = createDirectus<Schema>(directusUrl)
        .with(staticToken(directusToken))
        .with(rest())

      await directus.request(
        createItem('contact_submissions', {
          name,
          email,
          phone: phone || null,
          subject,
          message,
          status: 'new',
          ip_address: clientAddress ?? null,
        })
      )
    } catch (err) {
      // Log but don't fail — email fallback below will handle it
      console.error('[contact] Failed to save to Directus:', err)
    }
  }

  // Email notification via SMTP (optional)
  const smtpHost = process.env.SMTP_HOST
  const smtpTo = process.env.CONTACT_EMAIL_TO
  if (smtpHost && smtpTo) {
    try {
      // Dynamic import to avoid bundling nodemailer when not needed
      const nodemailer = await import('nodemailer').catch(() => null)
      if (nodemailer) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT ?? '587'),
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          } : undefined,
        })

        await transporter.sendMail({
          from: `"${name}" <${process.env.SMTP_USER ?? email}>`,
          to: smtpTo,
          replyTo: email,
          subject: `[Contatto] ${subject}`,
          text: `Nome: ${name}\nEmail: ${email}\nTelefono: ${phone || 'non fornito'}\n\n${message}`,
          html: `
            <p><strong>Nome:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Telefono:</strong> ${phone || 'non fornito'}</p>
            <hr />
            <p>${message.replace(/\n/g, '<br>')}</p>
          `,
        })
      }
    } catch (err) {
      console.error('[contact] Email send failed:', err)
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
