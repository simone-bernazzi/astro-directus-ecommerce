// src/pages/api/search.ts — product search + filter endpoint
export const prerender = false

import type { APIRoute } from 'astro'
import { getProducts, getDirectusImageUrl } from '@/lib/directus'

export interface SearchProduct {
  id: string
  slug: string
  name: string
  imageUrl: string | null
  categoryName: string | null
  price: number
  comparePrice: number | null
  type: string
  isOutOfStock: boolean
  featured: boolean
}

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() || undefined
  const categorySlug = url.searchParams.get('category') || undefined
  const productType = url.searchParams.get('type') as 'physical' | 'digital' | undefined
  const minPrice = url.searchParams.get('min_price') ? parseFloat(url.searchParams.get('min_price')!) : undefined
  const maxPrice = url.searchParams.get('max_price') ? parseFloat(url.searchParams.get('max_price')!) : undefined
  const limit = parseInt(url.searchParams.get('limit') ?? '48')

  try {
    const products = await getProducts({
      query: q,
      categorySlug,
      productType: productType && ['physical', 'digital'].includes(productType) ? productType : undefined,
      minPrice: isNaN(minPrice!) ? undefined : minPrice,
      maxPrice: isNaN(maxPrice!) ? undefined : maxPrice,
      limit: isNaN(limit) ? 48 : Math.min(limit, 100),
    })

    const results: SearchProduct[] = products.map(p => {
      const activeVariants = p.variants?.filter(v => v.is_active) ?? []
      const price = activeVariants[0]?.price_override ?? p.base_price
      const isOutOfStock = activeVariants.length > 0 && activeVariants.every(v => v.stock_quantity === 0)
      const firstImageFile = p.images?.[0]?.directus_files_id
      const firstImageId = typeof firstImageFile === 'string' ? firstImageFile : firstImageFile?.id ?? null
      const imageUrl = getDirectusImageUrl(firstImageId, { width: 600, quality: 80 })

      return {
        id: String(p.id),
        slug: p.slug,
        name: p.name,
        imageUrl,
        categoryName: p.category_id?.name ?? null,
        price,
        comparePrice: p.compare_price,
        type: p.type,
        isOutOfStock,
        featured: p.featured,
      }
    })

    return new Response(JSON.stringify({ results, total: results.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[api/search] error:', err)
    return new Response(JSON.stringify({ error: 'Search unavailable' }), { status: 503 })
  }
}
