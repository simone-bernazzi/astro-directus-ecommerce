// src/pages/robots.txt.ts
// Generato a build-time — riflette PUBLIC_SITE_URL
import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) => {
  const siteUrl = (site ?? import.meta.env.PUBLIC_SITE_URL ?? '').toString().replace(/\/$/, '')
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Area riservata — no index',
    'Disallow: /account/',
    'Disallow: /api/',
    'Disallow: /checkout/',
    '',
    `Sitemap: ${siteUrl}/sitemap-index.xml`,
    '',
  ].join('\n')

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
