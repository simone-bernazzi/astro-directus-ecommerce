import {
  createDirectus, rest, staticToken,
  readItems, createItem,
} from '@directus/sdk'
import nodemailer from 'nodemailer'
import type { Form, FormSubmission } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

function getEnv(key: string): string {
  return (
    (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.[key]) ||
    process.env[key] ||
    ''
  )
}

function createClient() {
  const url = getEnv('DIRECTUS_URL')
  const token = getEnv('DIRECTUS_TOKEN')
  if (!url) throw new Error('DIRECTUS_URL not configured.')
  let client = createDirectus<Schema>(url).with(rest())
  if (token) client = client.with(staticToken(token)) as typeof client
  return client
}

// ─── Directus queries ────────────────────────────────────────────────────────

export async function getForm(slug: string): Promise<Form | null> {
  const client = createClient()
  const items = await client.request(
    readItems('forms', {
      filter: { slug: { _eq: slug }, is_active: { _eq: true } },
      fields: ['*'],
      limit: 1,
    })
  )
  return (items as Form[])[0] ?? null
}

export async function getForms(): Promise<Form[]> {
  const client = createClient()
  const items = await client.request(
    readItems('forms', {
      filter: { is_active: { _eq: true } },
      fields: ['id', 'name', 'slug'],
    })
  )
  return items as Form[]
}

export async function saveSubmission(
  formId: string,
  payload: Omit<FormSubmission, 'id' | 'date_created' | 'is_read' | 'form_id'>
): Promise<FormSubmission> {
  const client = createClient()
  const item = await client.request(createItem('form_submissions', { form_id: formId, ...payload }))
  return item as FormSubmission
}

// ─── Keyword filter ───────────────────────────────────────────────────────────

export function containsBlockedKeyword(
  data: Record<string, unknown>,
  keywords: string[]
): boolean {
  const allValues = Object.values(data).join(' ').toLowerCase()
  return keywords.some(kw => allValues.includes(kw.toLowerCase()))
}

// ─── Email notification ───────────────────────────────────────────────────────

export async function sendNotificationEmail(options: {
  to: string
  formName: string
  data: Record<string, unknown>
  pageUrl: string | null
  country: string | null
  ipAddress: string | null
  userAgent: string | null
  submittedAt: string
}): Promise<void> {
  const host = getEnv('SMTP_HOST')
  const port = parseInt(getEnv('SMTP_PORT') || '587', 10)
  const user = getEnv('SMTP_USER')
  const pass = getEnv('SMTP_PASS')

  if (!host || !user || !pass) {
    console.warn('SMTP non configurato — email notifica non inviata')
    return
  }

  const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } })

  function esc(s: unknown): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }

  const fieldsHtml = Object.entries(options.data)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:bold;">${esc(k)}</td><td style="padding:4px 8px;">${esc(v)}</td></tr>`)
    .join('')

  const metaRows = [
    options.pageUrl ? `<tr><td style="padding:4px 8px;font-weight:bold;">URL pagina</td><td style="padding:4px 8px;">${esc(options.pageUrl)}</td></tr>` : '',
    options.country ? `<tr><td style="padding:4px 8px;font-weight:bold;">Paese</td><td style="padding:4px 8px;">${esc(options.country)}</td></tr>` : '',
    options.ipAddress ? `<tr><td style="padding:4px 8px;font-weight:bold;">IP</td><td style="padding:4px 8px;">${esc(options.ipAddress)}</td></tr>` : '',
    options.userAgent ? `<tr><td style="padding:4px 8px;font-weight:bold;">User Agent</td><td style="padding:4px 8px;font-size:11px;">${esc(options.userAgent)}</td></tr>` : '',
    `<tr><td style="padding:4px 8px;font-weight:bold;">Data/ora</td><td style="padding:4px 8px;">${esc(options.submittedAt)}</td></tr>`,
  ].filter(Boolean).join('')

  const html = `
    <h2>Nuovo invio form: ${esc(options.formName)}</h2>
    <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
      ${fieldsHtml}
    </table>
    <hr style="margin:16px 0;">
    <h3 style="color:#6b7280;">Info invio</h3>
    <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px;color:#6b7280;">
      ${metaRows}
    </table>
  `

  await transporter.sendMail({
    from: user,
    to: options.to,
    subject: `[Form] Nuovo messaggio da: ${options.formName}`,
    html,
  })
}
