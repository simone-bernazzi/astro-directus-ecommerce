// src/pages/api/download/[token].ts
export const prerender = false

import type { APIRoute } from 'astro'
import { createDirectus, rest, staticToken, readItems, updateItem } from '@directus/sdk'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

export const GET: APIRoute = async ({ params }) => {
  const { token } = params

  if (!token) {
    return new Response('Token mancante', { status: 400 })
  }

  const directus = createDirectus<Schema>(process.env.DIRECTUS_URL!)
    .with(staticToken(process.env.DIRECTUS_TOKEN!))
    .with(rest())

  const items = await directus.request(
    readItems('order_items', {
      filter: { download_token: { _eq: token } },
      limit: 1,
      fields: ['id', 'download_token', 'download_count', 'download_limit', 'download_expires_at', 'product_name', 'variant_id.*', 'variant_id.digital_file.*'],
    })
  ) as Array<Record<string, unknown>>

  const orderItem = items[0]
  if (!orderItem) {
    return new Response('Token non valido', { status: 404 })
  }

  if (orderItem.download_expires_at && new Date(orderItem.download_expires_at as string) < new Date()) {
    return new Response('Link di download scaduto', { status: 410 })
  }

  if ((orderItem.download_count as number) >= (orderItem.download_limit as number)) {
    return new Response('Limite download raggiunto', { status: 403 })
  }

  const variant = orderItem.variant_id as Record<string, unknown>

  // Increment download count before serving
  await directus.request(
    updateItem('order_items', orderItem.id as string, {
      download_count: (orderItem.download_count as number) + 1,
    })
  )

  // If a direct URL is configured, redirect to it (works for external CDNs and public Directus assets)
  const digitalFileUrl = variant?.digital_file_url as string | null
  if (digitalFileUrl) {
    return new Response(null, {
      status: 302,
      headers: { Location: digitalFileUrl, 'Cache-Control': 'no-store' },
    })
  }

  // Fallback: proxy the file from Directus (for protected assets)
  const digitalFile = variant?.digital_file as Record<string, unknown> | null
  if (!digitalFile?.id) {
    return new Response('File non trovato', { status: 404 })
  }

  const fileUrl = `${process.env.DIRECTUS_URL}/assets/${digitalFile.id}`
  const fileResponse = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
  })

  if (!fileResponse.ok) {
    return new Response('Errore nel recupero del file', { status: 502 })
  }

  const contentType = fileResponse.headers.get('content-type') ?? 'application/octet-stream'
  const filename = (digitalFile.filename_download as string) ?? 'download'

  return new Response(fileResponse.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
