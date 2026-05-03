// src/lib/types.ts

// ─── CMS (base template) ────────────────────────────────────────────────────

export interface DirectusFile {
  id: string
  filename_download: string
  title: string | null
  description: string | null
  width: number | null
  height: number | null
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Post {
  id: string
  title: string
  slug: string
  content: string | null
  cover: DirectusFile | null
  category: Category | null
  published_at: string
  status: 'published' | 'draft'
  excerpt: string | null
  seo_title: string | null
  seo_description: string | null
}

export interface PortfolioItem {
  id: string
  title: string
  slug: string
  cover: DirectusFile | null
  gallery: DirectusFile[] | null
  client: string | null
  year: number | null
  tags: string[] | null
  description: string | null
  status: 'published' | 'draft'
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string | null
  sort_order: number
}

export interface PageBlock {
  type: 'hero' | 'features' | 'cta' | 'testimonials' | 'blog_grid' | 'portfolio_grid' | 'faq' | 'contact_form'
  data: Record<string, unknown>
}

export interface Page {
  id: string
  title: string
  slug: string
  blocks: PageBlock[] | null
  seo_title: string | null
  seo_description: string | null
  status: 'published' | 'draft'
}

export interface SiteSettings {
  site_name: string
  logo: DirectusFile | null
  nav_links: Array<{ label: string; url: string }> | null
  social: Array<{ platform: string; url: string }> | null
  footer_text: string | null
}

// ─── E-commerce ──────────────────────────────────────────────────────────────

export type ProductType = 'physical' | 'digital'

export interface ProductCategory {
  id: string
  name: string
  slug: string
  parent_id: ProductCategory | null
  description: string | null
  image: DirectusFile | null
  sort_order: number
  seo_title: string | null
  seo_description: string | null
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  name: string
  option_1_name: string | null
  option_1_value: string | null
  option_2_name: string | null
  option_2_value: string | null
  price_override: number | null
  stock_quantity: number
  low_stock_threshold: number
  stripe_price_id: string
  digital_file: DirectusFile | null
  download_limit: number
  download_expires_hours: number
  image_id: DirectusFile | null
  is_active: boolean
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  type: ProductType
  base_price: number
  compare_price: number | null
  images: Array<{ directus_files_id: DirectusFile | string }> | null
  category_id: ProductCategory | null
  stripe_product_id: string
  weight_g: number
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  is_active: boolean
  featured: boolean
  sort_order: number
  seo_title: string | null
  seo_description: string | null
  tags: Array<{ tags_id: string }> | null
  variants: ProductVariant[]
  status: 'published' | 'draft'
}

export interface ShippingZone {
  id: string
  name: string
  countries: string[]
  base_rate: number
  free_shipping_threshold: number | null
  rate_per_kg: number
  max_weight_g: number | null
  is_active: boolean
}

export interface Coupon {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  min_order_amount: number | null
  max_uses: number | null
  used_count: number
  expires_at: string | null
  stripe_coupon_id: string | null
  is_active: boolean
  description: string | null
}

export interface GiftCard {
  id: string
  code: string
  initial_value: number
  remaining_value: number
  expires_at: string | null
  is_active: boolean
  redemptions: Array<{ date: string; amount: number; order_id: string }> | null
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'refunded'

export interface ShippingAddress {
  name: string
  line1: string
  line2: string | null
  city: string
  postal_code: string
  state: string
  country: string
}

export interface OrderItemSnapshot {
  product_name: string
  variant_name: string
  sku: string
  unit_price: number
  quantity: number
}

export interface OrderItem {
  id: string
  order_id: string
  product_name: string
  variant_name: string
  sku: string
  unit_price: number
  quantity: number
  download_token: string | null
  download_count: number
  download_limit: number
  download_expires_at: string | null
}

export interface Order {
  id: string
  stripe_session_id: string
  status: OrderStatus
  customer_email: string
  customer_name: string
  customer_id: string | null
  subtotal: number
  discount_amount: number
  shipping_cost: number
  total: number
  coupon_id: string | null
  gift_card_id: string | null
  gift_card_amount_used: number | null
  shipping_address: ShippingAddress
  shipping_zone_id: string | null
  notes: string | null
  tracking_number: string | null
  tracking_url: string | null
  items: OrderItemSnapshot[]
  order_items: OrderItem[]
  date_created: string
}

export interface Customer {
  id: string
  directus_user_id: string
  first_name: string
  last_name: string
  phone: string | null
  default_shipping_address: ShippingAddress | null
  stripe_customer_id: string | null
  total_orders: number
  total_spent: number
}

// ─── Cart (client-side) ──────────────────────────────────────────────────────

export interface CartItem {
  variantId: string
  productId: string
  productSlug: string
  productName: string
  variantName: string
  sku: string
  price: number
  quantity: number
  image: string | null
  type: ProductType
  weightG: number
}
