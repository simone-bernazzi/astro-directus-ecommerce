// src/lib/directus.ts
import {
  createDirectus,
  rest,
  readItems,
  readSingleton,
  staticToken,
} from '@directus/sdk'
import type {
  Post,
  Page,
  PortfolioItem,
  FaqItem,
  SiteSettings,
  Category,
} from './types'

// ---------------------------------------------------------------------------
// URL / token helpers — read lazily so that process.env mutations in tests
// (or Astro's import.meta.env at build time) are always picked up.
// ---------------------------------------------------------------------------

function getDirectusUrl(): string {
  return (
    (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.DIRECTUS_URL) ||
    process.env.DIRECTUS_URL ||
    ''
  )
}

function getDirectusToken(): string {
  return (
    (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.DIRECTUS_TOKEN) ||
    process.env.DIRECTUS_TOKEN ||
    ''
  )
}

// Minimal schema type so TypeScript accepts arbitrary collection names.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

function getClient() {
  const url = getDirectusUrl()
  const token = getDirectusToken()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any = createDirectus<Schema>(url).with(rest())

  if (token) {
    client = client.with(staticToken(token))
  }

  return client as { request: (cmd: unknown) => Promise<unknown> }
}

// ---------------------------------------------------------------------------
// Image URL helper
// ---------------------------------------------------------------------------

export function getDirectusImageUrl(
  fileId: string | null | undefined,
  params?: { width?: number; height?: number; quality?: number; fit?: string }
): string {
  if (!fileId) return ''
  const base = `${getDirectusUrl()}/assets/${fileId}`
  if (!params) return base
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString()
  return query ? `${base}?${query}` : base
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface GetPostsOptions {
  category?: string
  limit?: number
  offset?: number
}

export async function getPosts(options: GetPostsOptions = {}): Promise<Post[]> {
  const client = getClient()
  const filter: Record<string, unknown> = { status: { _eq: 'published' } }
  if (options.category) {
    filter['category'] = { slug: { _eq: options.category } }
  }
  const items = await client.request(
    readItems('posts', {
      filter,
      limit: options.limit ?? -1,
      offset: options.offset ?? 0,
      fields: ['id', 'title', 'slug', 'excerpt', 'published_at', 'status', 'cover.*', 'category.name', 'category.slug'],
      sort: ['-published_at'],
    })
  )
  return items as Post[]
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const client = getClient()
  const items = await client.request(
    readItems('posts', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      limit: 1,
      fields: ['*', 'cover.*', 'category.*'],
    })
  )
  const list = items as Post[]
  return list[0] ?? null
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function getPages(): Promise<Page[]> {
  const client = getClient()
  const items = await client.request(
    readItems('pages', {
      filter: { status: { _eq: 'published' } },
      fields: ['*'],
    })
  )
  return items as Page[]
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const client = getClient()
  const items = await client.request(
    readItems('pages', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      limit: 1,
      fields: ['*'],
    })
  )
  const list = items as Page[]
  return list[0] ?? null
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export interface GetPortfolioOptions {
  limit?: number
  offset?: number
}

export async function getPortfolioItems(
  options: GetPortfolioOptions = {}
): Promise<PortfolioItem[]> {
  const client = getClient()
  const items = await client.request(
    readItems('portfolio', {
      filter: { status: { _eq: 'published' } },
      limit: options.limit ?? -1,
      offset: options.offset ?? 0,
      fields: ['*', 'cover.*'],
      sort: ['-year', 'title'],
    })
  )
  return items as PortfolioItem[]
}

export async function getPortfolioItemBySlug(
  slug: string
): Promise<PortfolioItem | null> {
  const client = getClient()
  const items = await client.request(
    readItems('portfolio', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      limit: 1,
      fields: ['*', 'cover.*', 'gallery.*'],
    })
  )
  const list = items as PortfolioItem[]
  return list[0] ?? null
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export async function getFaqItems(): Promise<FaqItem[]> {
  const client = getClient()
  const items = await client.request(
    readItems('faq', {
      fields: ['*'],
      sort: ['sort_order'],
    })
  )
  return items as FaqItem[]
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const client = getClient()
  const items = await client.request(
    readItems('categories', {
      fields: ['*'],
      sort: ['name'],
    })
  )
  return items as Category[]
}

// ---------------------------------------------------------------------------
// Site Settings (singleton)
// ---------------------------------------------------------------------------

export async function getSiteSettings(): Promise<SiteSettings> {
  const client = getClient()
  const data = await client.request(
    readSingleton('site_settings', {
      fields: ['*', 'logo.*'],
    })
  )
  return data as SiteSettings
}
