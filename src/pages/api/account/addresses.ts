// src/pages/api/account/addresses.ts — CRUD for saved shipping addresses
// Addresses are stored as a JSON array on the contact record (contacts.shipping_addresses).
// Auth: directus_token cookie (Directus JWT).
export const prerender = false

import type { APIRoute } from 'astro'
import { createDirectus, rest, staticToken, readItems, createItem, updateItem } from '@directus/sdk'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

export interface ShippingAddress {
  id: string
  label: string
  name: string
  line1: string
  line2: string | null
  city: string
  postal_code: string
  state: string | null
  country: string
  is_default: boolean
}

function getAdminClient() {
  return createDirectus<Schema>(process.env.DIRECTUS_URL!)
    .with(staticToken(process.env.DIRECTUS_TOKEN!))
    .with(rest())
}

async function getUserFromToken(token: string): Promise<{ id: string; email: string } | null> {
  const res = await fetch(`${process.env.DIRECTUS_URL}/users/me?fields=id,email`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = await res.json() as { data?: { id: string; email: string } }
  return data.data ?? null
}

async function getOrCreateContact(directus: ReturnType<typeof getAdminClient>, user: { id: string; email: string }) {
  const existing = await directus.request(
    readItems('contacts', {
      filter: { user_id: { _eq: user.id } },
      limit: 1,
      fields: ['id', 'shipping_addresses'],
    })
  ) as Array<{ id: string; shipping_addresses: ShippingAddress[] | null }>

  if (existing[0]) return existing[0]

  const byEmail = await directus.request(
    readItems('contacts', {
      filter: { email: { _eq: user.email } },
      limit: 1,
      fields: ['id', 'shipping_addresses'],
    })
  ) as Array<{ id: string; shipping_addresses: ShippingAddress[] | null }>

  if (byEmail[0]) {
    await directus.request(updateItem('contacts', byEmail[0].id, { user_id: user.id }))
    return byEmail[0]
  }

  const created = await directus.request(
    createItem('contacts', { email: user.email, user_id: user.id, shipping_addresses: [], channel_type: 'online' })
  ) as { id: string; shipping_addresses: ShippingAddress[] | null }
  return created
}

function authToken(request: Request, cookies: Record<string, string>) {
  return cookies['directus_token'] ?? null
}

// ── GET ────────────────────────────────────────────────────────────────────────
export const GET: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('directus_token')?.value
  if (!token) return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401 })

  const user = await getUserFromToken(token)
  if (!user) return new Response(JSON.stringify({ error: 'Token non valido' }), { status: 401 })

  const directus = getAdminClient()
  const customer = await getOrCreateContact(directus, user)
  const addresses: ShippingAddress[] = Array.isArray(customer.shipping_addresses) ? customer.shipping_addresses : []

  return new Response(JSON.stringify({ addresses }), { status: 200 })
}

// ── POST (add new address) ─────────────────────────────────────────────────────
const AddressSchema = z.object({
  label: z.string().min(1).max(50).default('Casa'),
  name: z.string().min(1).max(100),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().min(1).max(100),
  postal_code: z.string().min(1).max(20),
  state: z.string().max(100).nullable().optional(),
  country: z.string().min(2).max(100),
  is_default: z.boolean().default(false),
})

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('directus_token')?.value
  if (!token) return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401 })

  const user = await getUserFromToken(token)
  if (!user) return new Response(JSON.stringify({ error: 'Token non valido' }), { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Dati non validi' }), { status: 400 })
  }

  const parsed = AddressSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Dati non validi', details: parsed.error.flatten() }), { status: 400 })
  }

  const directus = getAdminClient()
  const customer = await getOrCreateContact(directus, user)
  let addresses: ShippingAddress[] = Array.isArray(customer.shipping_addresses) ? customer.shipping_addresses : []

  const newAddress: ShippingAddress = {
    id: randomUUID(),
    label: parsed.data.label,
    name: parsed.data.name,
    line1: parsed.data.line1,
    line2: parsed.data.line2 ?? null,
    city: parsed.data.city,
    postal_code: parsed.data.postal_code,
    state: parsed.data.state ?? null,
    country: parsed.data.country,
    is_default: parsed.data.is_default,
  }

  if (newAddress.is_default) {
    addresses = addresses.map(a => ({ ...a, is_default: false }))
  }
  if (addresses.length === 0) newAddress.is_default = true

  addresses.push(newAddress)
  await directus.request(updateItem('contacts', customer.id, { shipping_addresses: addresses }))

  return new Response(JSON.stringify({ address: newAddress }), { status: 201 })
}

// ── DELETE ?id=<uuid> ─────────────────────────────────────────────────────────
export const DELETE: APIRoute = async ({ request, cookies, url }) => {
  const token = cookies.get('directus_token')?.value
  if (!token) return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401 })

  const user = await getUserFromToken(token)
  if (!user) return new Response(JSON.stringify({ error: 'Token non valido' }), { status: 401 })

  const id = url.searchParams.get('id')
  if (!id) return new Response(JSON.stringify({ error: 'id obbligatorio' }), { status: 400 })

  const directus = getAdminClient()
  const customer = await getOrCreateContact(directus, user)
  let addresses: ShippingAddress[] = Array.isArray(customer.shipping_addresses) ? customer.shipping_addresses : []

  const wasDefault = addresses.find(a => a.id === id)?.is_default ?? false
  addresses = addresses.filter(a => a.id !== id)
  if (wasDefault && addresses.length > 0) addresses[0].is_default = true

  await directus.request(updateItem('contacts', customer.id, { shipping_addresses: addresses }))
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

// ── PATCH ?id=<uuid>&default=true ─────────────────────────────────────────────
export const PATCH: APIRoute = async ({ request, cookies, url }) => {
  const token = cookies.get('directus_token')?.value
  if (!token) return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401 })

  const user = await getUserFromToken(token)
  if (!user) return new Response(JSON.stringify({ error: 'Token non valido' }), { status: 401 })

  const id = url.searchParams.get('id')
  if (!id) return new Response(JSON.stringify({ error: 'id obbligatorio' }), { status: 400 })

  const directus = getAdminClient()
  const customer = await getOrCreateContact(directus, user)
  const addresses: ShippingAddress[] = Array.isArray(customer.shipping_addresses) ? customer.shipping_addresses : []

  const setDefault = url.searchParams.get('default') === 'true'
  if (setDefault) {
    addresses.forEach(a => { a.is_default = a.id === id })
  }

  await directus.request(updateItem('contacts', customer.id, { shipping_addresses: addresses }))
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
