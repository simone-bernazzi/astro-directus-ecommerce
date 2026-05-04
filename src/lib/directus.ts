// src/lib/directus.ts
import {
  createDirectus,
  rest,
  readItems,
  readItem,
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
  Product,
  ProductCategory,
  ShippingZone,
  Coupon,
  GiftCard,
  Order,
} from './types'

// ---------------------------------------------------------------------------
// URL / token helpers
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

function getClient() {
  const url = getDirectusUrl()
  const token = getDirectusToken()

  if (!url) {
    throw new Error('DIRECTUS_URL not configured. Add it to your .env file.')
  }

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
// Categories (blog)
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

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface GetProductsOptions {
  featured?: boolean
  categorySlug?: string
  limit?: number
  query?: string
  productType?: 'physical' | 'digital'
  minPrice?: number
  maxPrice?: number
}

const PRODUCT_FIELDS = [
  '*',
  'images.directus_files_id.*',
  'category_id.*',
  'variants.*',
  'variants.image_id.*',
  'variants.digital_file.*',
]

export async function getProducts(options: GetProductsOptions = {}): Promise<Product[]> {
  const client = getClient()
  const andClauses: Record<string, unknown>[] = [
    { status: { _eq: 'published' } },
    { is_active: { _eq: true } },
  ]
  if (options.featured) andClauses.push({ featured: { _eq: true } })
  if (options.categorySlug) andClauses.push({ category_id: { slug: { _eq: options.categorySlug } } })
  if (options.productType) andClauses.push({ type: { _eq: options.productType } })
  if (options.minPrice !== undefined) andClauses.push({ base_price: { _gte: options.minPrice } })
  if (options.maxPrice !== undefined) andClauses.push({ base_price: { _lte: options.maxPrice } })
  if (options.query) {
    andClauses.push({ _or: [
      { name: { _icontains: options.query } },
      { description: { _icontains: options.query } },
    ] })
  }

  const items = await client.request(
    readItems('products', {
      filter: { _and: andClauses },
      limit: options.limit ?? -1,
      fields: PRODUCT_FIELDS,
      sort: ['sort_order', 'name'],
    })
  )
  return items as Product[]
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  const client = getClient()
  const items = await client.request(
    readItems('products', {
      filter: { id: { _in: ids }, status: { _eq: 'published' }, is_active: { _eq: true } },
      fields: PRODUCT_FIELDS,
    })
  )
  return items as Product[]
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const client = getClient()
  const items = await client.request(
    readItems('products', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' }, is_active: { _eq: true } },
      limit: 1,
      fields: PRODUCT_FIELDS,
    })
  )
  const list = items as Product[]
  return list[0] ?? null
}

export async function getProductSlugs(): Promise<string[]> {
  const client = getClient()
  const items = await client.request(
    readItems('products', {
      filter: { status: { _eq: 'published' }, is_active: { _eq: true } },
      fields: ['slug'],
    })
  ) as Array<{ slug: string }>
  return items.map(i => i.slug)
}

export interface VariantOption {
  name: string
  values: string[]
}

export async function getVariantOptions(): Promise<VariantOption[]> {
  const client = getClient()
  const variants = await client.request(
    readItems('product_variants', {
      filter: {
        is_active: { _eq: true },
        product_id: { status: { _eq: 'published' }, is_active: { _eq: true } },
      },
      fields: ['option_1_name', 'option_1_value', 'option_2_name', 'option_2_value'],
      limit: -1,
    })
  ) as Array<{ option_1_name: string | null; option_1_value: string | null; option_2_name: string | null; option_2_value: string | null }>

  const map = new Map<string, Set<string>>()
  for (const v of variants) {
    if (v.option_1_name && v.option_1_value) {
      if (!map.has(v.option_1_name)) map.set(v.option_1_name, new Set())
      map.get(v.option_1_name)!.add(v.option_1_value)
    }
    if (v.option_2_name && v.option_2_value) {
      if (!map.has(v.option_2_name)) map.set(v.option_2_name, new Set())
      map.get(v.option_2_name)!.add(v.option_2_value)
    }
  }

  return Array.from(map.entries())
    .filter(([, s]) => s.size > 0)
    .map(([name, set]) => ({ name, values: Array.from(set).sort() }))
}

// ---------------------------------------------------------------------------
// Product Categories
// ---------------------------------------------------------------------------

export async function getProductCategories(): Promise<ProductCategory[]> {
  const client = getClient()
  const items = await client.request(
    readItems('product_categories', {
      fields: ['*', 'image.*', 'parent_id.*'],
      sort: ['sort_order', 'name'],
    })
  )
  return items as ProductCategory[]
}

export async function getProductCategoryBySlug(slug: string): Promise<ProductCategory | null> {
  const client = getClient()
  const items = await client.request(
    readItems('product_categories', {
      filter: { slug: { _eq: slug } },
      limit: 1,
      fields: ['*', 'image.*'],
    })
  )
  const list = items as ProductCategory[]
  return list[0] ?? null
}

// ---------------------------------------------------------------------------
// Shipping Zones
// ---------------------------------------------------------------------------

export async function getShippingZones(): Promise<ShippingZone[]> {
  const client = getClient()
  const items = await client.request(
    readItems('shipping_zones', {
      filter: { is_active: { _eq: true } },
      fields: ['*'],
    })
  )
  return items as ShippingZone[]
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const client = getClient()
  const items = await client.request(
    readItems('coupons', {
      filter: { code: { _icontains: code }, is_active: { _eq: true } },
      limit: 1,
      fields: ['*'],
    })
  )
  const list = items as Coupon[]
  return list[0] ?? null
}

// ---------------------------------------------------------------------------
// Gift Cards
// ---------------------------------------------------------------------------

export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  const client = getClient()
  const items = await client.request(
    readItems('gift_cards', {
      filter: { code: { _eq: code }, is_active: { _eq: true } },
      limit: 1,
      fields: ['id', 'code', 'initial_value', 'remaining_value', 'expires_at', 'is_active', 'redemptions'],
    })
  )
  const list = items as GiftCard[]
  return list[0] ?? null
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  const client = getClient()
  const items = await client.request(
    readItems('orders', {
      filter: { customer_id: { _eq: customerId } },
      fields: ['*', 'order_items.*'],
      sort: ['-date_created'],
    })
  )
  return items as Order[]
}

export async function getOrderById(id: string): Promise<Order | null> {
  const client = getClient()
  try {
    const item = await client.request(
      readItem('orders', id, { fields: ['*', 'order_items.*'] })
    )
    return item as Order
  } catch {
    return null
  }
}

export async function getOrderBySessionId(sessionId: string): Promise<Order | null> {
  const client = getClient()
  const items = await client.request(
    readItems('orders', {
      filter: { stripe_session_id: { _eq: sessionId } },
      limit: 1,
      fields: ['*', 'order_items.*'],
    })
  )
  const list = items as Order[]
  return list[0] ?? null
}
