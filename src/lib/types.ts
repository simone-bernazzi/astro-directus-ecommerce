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
  // i18n EN fields
  title_en?: string | null
  content_en?: string | null
  excerpt_en?: string | null
  seo_title_en?: string | null
  seo_description_en?: string | null
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
  // i18n EN fields
  title_en?: string | null
  description_en?: string | null
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string | null
  sort_order: number
  // i18n EN fields
  question_en?: string | null
  answer_en?: string | null
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
  // i18n EN fields
  name_en?: string | null
  description_en?: string | null
  seo_title_en?: string | null
  seo_description_en?: string | null
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
  digital_file_url: string | null
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
  // i18n EN fields
  name_en?: string | null
  description_en?: string | null
  seo_title_en?: string | null
  seo_description_en?: string | null
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
  cross_sell_ids: string[] | null
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
  channel: 'online' | 'offline'
  contact_id: string | null
  staff_id: string | null
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
  contact_id: string | null
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
  stockQuantity: number
  image: string | null
  type: ProductType
  weightG: number
}

// ─── CRM ─────────────────────────────────────────────────────────────────────

export type ChannelType = 'offline' | 'online' | 'both'
export type PipelineStage =
  | 'lead'
  | 'prospect'
  | 'cliente_attivo'
  | 'cliente_fidelizzato'
  | 'inattivo'
export type InteractionType = 'call' | 'visit' | 'email' | 'whatsapp' | 'note' | 'other'
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high'
export type CrmDocumentType = 'preventivo' | 'contratto' | 'foto' | 'prescrizione' | 'altro'
export type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'dormant' | 'new' | 'other'

export interface CrmTag {
  id: string
  name: string
  color: string
  description: string | null
}

export interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  channel_type: ChannelType
  canale_prevalente: 'offline' | 'online'
  pipeline_stage: PipelineStage
  customer_id: string | null
  default_shipping_address: ShippingAddress | null
  is_active: boolean
  tags: CrmTag[]
  date_created: string
}

export interface CrmInteraction {
  id: string
  contact_id: string
  type: InteractionType
  date: string
  subject: string | null
  body: string
  outcome: string | null
  staff_id: string | null
}

export interface CrmTask {
  id: string
  contact_id: string
  title: string
  due_date: string
  status: TaskStatus
  priority: TaskPriority
  assigned_to: string | null
  notes: string | null
}

export interface CrmDocument {
  id: string
  contact_id: string
  file_id: string
  label: string
  type: CrmDocumentType
}

export interface CrmPipelineHistory {
  id: string
  contact_id: string
  from_stage: PipelineStage
  to_stage: PipelineStage
  date: string
  changed_by: string | null
  notes: string | null
}

export interface CustomerKpi {
  id: string
  contact_id: string
  clv: number
  churn_score: number
  lead_score: number
  total_spent_online: number
  total_spent_offline: number
  total_orders_online: number
  total_orders_offline: number
  last_purchase_at: string | null
  avg_order_value: number
  preferred_channel: 'offline' | 'online'
  rfm_segment: RfmSegment
  calculated_at: string | null
}

// ─── Contact Forms ────────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'file'

export interface FormField {
  name: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder?: string
  options?: string[]
}

export interface Form {
  id: string
  name: string
  slug: string
  fields: FormField[]
  success_message: string | null
  redirect_enabled: boolean
  redirect_url: string | null
  notification_email: string | null
  recaptcha_enabled: boolean
  capture_ip: boolean
  capture_user_agent: boolean
  capture_page_url: boolean
  honeypot_enabled: boolean
  country_filter_enabled: boolean
  allowed_countries: string[] | null
  keyword_filter_enabled: boolean
  blocked_keywords: string[] | null
  is_active: boolean
}

export interface FormSubmission {
  id: string
  form_id: string
  data: Record<string, unknown>
  page_url: string | null
  ip_address: string | null
  user_agent: string | null
  country_code: string | null
  is_read: boolean
  date_created: string
}
