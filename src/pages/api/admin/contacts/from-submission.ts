// src/pages/api/admin/contacts/from-submission.ts
export const prerender = false

import type { APIRoute } from 'astro'

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? ''

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('admin_token')?.value
  if (!token) return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 401 })

  let body: { submission_id?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }
  if (!body.submission_id) {
    return new Response(JSON.stringify({ error: 'submission_id obbligatorio' }), { status: 400 })
  }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 1. Legge la submission
  let submissionRes: Response
  try {
    submissionRes = await fetch(`${DIRECTUS_URL}/items/form_submissions/${body.submission_id}?fields[]=id,data,is_read`, { headers })
  } catch {
    return new Response(JSON.stringify({ error: 'Servizio non raggiungibile' }), { status: 503 })
  }
  if (!submissionRes.ok) return new Response(JSON.stringify({ error: 'Submission non trovata' }), { status: 404 })

  const { data: submission } = await submissionRes.json() as { data: { id: string; data: Record<string, unknown>; is_read: boolean } }
  const fields = submission.data

  // 2. Estrae nome/email/phone dai campi comuni
  const rawName = String(fields.name ?? fields.nome ?? fields.first_name ?? '')
  const nameParts = rawName.trim().split(/\s+/)
  const first_name = nameParts[0] ?? 'Contatto'
  const last_name = nameParts.slice(1).join(' ') || 'Submission'
  const email = fields.email ? String(fields.email) : null
  const phone = (fields.phone ?? fields.telefono ?? fields.tel) ? String(fields.phone ?? fields.telefono ?? fields.tel) : null

  // 3. Crea il contatto
  let contactRes: Response
  try {
    contactRes = await fetch(`${DIRECTUS_URL}/items/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        first_name,
        last_name,
        email,
        phone,
        pipeline_stage: 'lead',
        canale_prevalente: 'online',
        channel_type: 'online',
        is_active: true,
      }),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Errore creazione contatto' }), { status: 503 })
  }
  if (!contactRes.ok) {
    const err = await contactRes.json().catch(() => ({}))
    return new Response(JSON.stringify({ error: 'Errore creazione contatto', details: err }), { status: 500 })
  }

  const { data: newContact } = await contactRes.json() as { data: { id: string } }

  // 4. Marca la submission come letta
  try {
    await fetch(`${DIRECTUS_URL}/items/form_submissions/${body.submission_id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_read: true }),
    })
  } catch { /* non bloccante */ }

  return new Response(JSON.stringify({ contact_id: newContact.id }), { status: 200 })
}
