// scripts/setup-collections.mjs
// Crea tutte le collezioni e-commerce su Directus
// Usage: node scripts/setup-collections.mjs  (legge .env in automatico)

import { createDirectus, rest, staticToken, createCollection, createField, createRelation } from '@directus/sdk'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Carica .env dalla root del progetto
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* .env non presente, usa variabili d'ambiente esistenti */ }

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? 'http://localhost:8055'
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN

if (!DIRECTUS_TOKEN) {
  console.error('Errore: DIRECTUS_TOKEN non impostato')
  process.exit(1)
}

const client = createDirectus(DIRECTUS_URL)
  .with(staticToken(DIRECTUS_TOKEN))
  .with(rest())

async function safe(fn, label) {
  try {
    await fn()
    console.log(`  ✓ ${label}`)
  } catch (e) {
    const msg = e?.errors?.[0]?.message ?? e?.message ?? String(e)
    if (msg.includes('already exists') || msg.includes('RECORD_NOT_UNIQUE') || msg.includes('duplicate') || msg.includes('already has an associated relationship')) {
      console.log(`  · ${label} (già presente)`)
    } else {
      console.error(`  ✗ ${label}: ${msg}`)
    }
  }
}

async function collection(name, icon, displayTemplate) {
  await safe(() => client.request(createCollection({
    collection: name,
    meta: { icon, display_template: displayTemplate },
    schema: { name },
  })), `collection: ${name}`)
}

async function field(collection, name, type, schema = {}, meta = {}) {
  await safe(() => client.request(createField(collection, { field: name, type, schema: { name, ...schema }, meta })),
    `${collection}.${name}`)
}

async function main() {
  console.log(`\nSetup collezioni e-commerce → ${DIRECTUS_URL}\n`)

  // ── product_categories ────────────────────────────────────────────────────
  await collection('product_categories', 'category', '{{name}}')
  await field('product_categories', 'name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('product_categories', 'slug', 'string', { is_unique: true }, { interface: 'input' })
  await field('product_categories', 'description', 'text', {}, { interface: 'input-multiline' })
  await field('product_categories', 'sort_order', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('product_categories', 'seo_title', 'string', {}, { interface: 'input' })
  await field('product_categories', 'seo_description', 'text', {}, { interface: 'input-multiline' })
  // i18n EN
  await field('product_categories', 'name_en', 'string', { is_nullable: true }, { interface: 'input', note: 'Nome categoria in inglese' })
  await field('product_categories', 'description_en', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('product_categories', 'seo_title_en', 'string', { is_nullable: true }, { interface: 'input' })
  await field('product_categories', 'seo_description_en', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── products ──────────────────────────────────────────────────────────────
  await collection('products', 'shopping_bag', '{{name}}')
  await field('products', 'status', 'string', { default_value: 'draft' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Pubblicato', value: 'published' }, { text: 'Bozza', value: 'draft' }] } })
  await field('products', 'name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('products', 'slug', 'string', { is_unique: true }, { interface: 'input' })
  await field('products', 'description', 'text', {}, { interface: 'input-rich-text-html' })
  await field('products', 'type', 'string', { default_value: 'physical' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Fisico', value: 'physical' }, { text: 'Digitale', value: 'digital' }] } })
  await field('products', 'base_price', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('products', 'compare_price', 'decimal', { numeric_precision: 10, numeric_scale: 2, is_nullable: true }, { interface: 'input' })
  await field('products', 'stripe_product_id', 'string', {}, { interface: 'input' })
  await field('products', 'weight_g', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('products', 'width_mm', 'integer', { is_nullable: true }, { interface: 'input' })
  await field('products', 'height_mm', 'integer', { is_nullable: true }, { interface: 'input' })
  await field('products', 'depth_mm', 'integer', { is_nullable: true }, { interface: 'input' })
  await field('products', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })
  await field('products', 'featured', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('products', 'sort_order', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('products', 'seo_title', 'string', {}, { interface: 'input' })
  await field('products', 'seo_description', 'text', {}, { interface: 'input-multiline' })
  await field('products', 'cross_sell_ids', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' }, note: 'Array JSON di ID prodotto da mostrare come "Spesso acquistato insieme"' })
  // i18n EN
  await field('products', 'name_en', 'string', { is_nullable: true }, { interface: 'input', note: 'Nome prodotto in inglese' })
  await field('products', 'description_en', 'text', { is_nullable: true }, { interface: 'input-rich-text-html', note: 'Descrizione in inglese' })
  await field('products', 'seo_title_en', 'string', { is_nullable: true }, { interface: 'input' })
  await field('products', 'seo_description_en', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('products', 'category_id', 'integer', { is_nullable: true }, { interface: 'input', hidden: true })
  // CRM fields
  await field('products', 'is_ecommerce', 'boolean', { default_value: false }, { interface: 'boolean', note: 'Se true, il prodotto è pubblicato sul sito e-commerce' })
  await field('products', 'is_archived', 'boolean', { default_value: false }, { interface: 'boolean', note: 'Soft delete dal catalogo' })
  await field('products', 'date_created', 'timestamp', { is_nullable: true }, { interface: 'datetime', readonly: true, hidden: true, special: ['date-created'] })
  await field('products', 'date_updated', 'timestamp', { is_nullable: true }, { interface: 'datetime', readonly: true, hidden: true, special: ['date-updated'] })

  // ── product_variants ──────────────────────────────────────────────────────
  await collection('product_variants', 'tune', '{{name}} ({{sku}})')
  await field('product_variants', 'sku', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('product_variants', 'name', 'string', {}, { interface: 'input' })
  await field('product_variants', 'option_1_name', 'string', { is_nullable: true }, { interface: 'input' })
  await field('product_variants', 'option_1_value', 'string', { is_nullable: true }, { interface: 'input' })
  await field('product_variants', 'option_2_name', 'string', { is_nullable: true }, { interface: 'input' })
  await field('product_variants', 'option_2_value', 'string', { is_nullable: true }, { interface: 'input' })
  await field('product_variants', 'price_override', 'decimal', { numeric_precision: 10, numeric_scale: 2, is_nullable: true }, { interface: 'input' })
  await field('product_variants', 'stock_quantity', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('product_variants', 'low_stock_threshold', 'integer', { default_value: 5 }, { interface: 'input' })
  await field('product_variants', 'stripe_price_id', 'string', {}, { interface: 'input' })
  await field('product_variants', 'digital_file_url', 'string', { is_nullable: true }, { interface: 'input', note: 'URL file digitale (esterno o Directus). Per file su Directus non superare 150 MB.' })
  await field('product_variants', 'download_limit', 'integer', { default_value: 3 }, { interface: 'input' })
  await field('product_variants', 'download_expires_hours', 'integer', { default_value: 168 }, { interface: 'input' })
  await field('product_variants', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })
  await field('product_variants', 'product_id', 'integer', { is_nullable: true }, { interface: 'input', hidden: true })

  // ── orders ────────────────────────────────────────────────────────────────
  await collection('orders', 'receipt', '{{customer_email}} — {{total}}€')
  await field('orders', 'stripe_session_id', 'string', { is_unique: true }, { interface: 'input' })
  await field('orders', 'status', 'string', { default_value: 'pending' }, { interface: 'select-dropdown', options: { choices: ['pending','paid','shipped','delivered','refunded'].map(v => ({ text: v, value: v })) } })
  await field('orders', 'customer_email', 'string', {}, { interface: 'input' })
  await field('orders', 'customer_name', 'string', {}, { interface: 'input' })
  await field('orders', 'subtotal', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('orders', 'discount_amount', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('orders', 'shipping_cost', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('orders', 'total', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('orders', 'gift_card_amount_used', 'decimal', { numeric_precision: 10, numeric_scale: 2, is_nullable: true }, { interface: 'input' })
  await field('orders', 'shipping_address', 'json', {}, { interface: 'input-code', options: { language: 'json' } })
  await field('orders', 'items', 'json', {}, { interface: 'input-code', options: { language: 'json' } })
  await field('orders', 'notes', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('orders', 'tracking_number', 'string', { is_nullable: true }, { interface: 'input' })
  await field('orders', 'tracking_url', 'string', { is_nullable: true }, { interface: 'input' })
  // CRM fields
  await field('orders', 'channel', 'string', { default_value: 'online' }, {
    interface: 'select-dropdown',
    options: { choices: [{ text: 'Online', value: 'online' }, { text: 'Offline (negozio)', value: 'offline' }] },
    note: 'Canale di vendita',
  })
  await field('orders', 'contact_id', 'integer', { is_nullable: true }, { interface: 'input', hidden: true, note: 'FK → contacts (CRM)' })
  await field('orders', 'staff_id', 'uuid', { is_nullable: true }, { interface: 'input', hidden: true, note: 'Operatore che ha processato ordine offline' })
  await field('orders', 'date_created', 'timestamp', { is_nullable: true }, { interface: 'datetime', readonly: true, hidden: true, special: ['date-created'] })

  // ── order_items ───────────────────────────────────────────────────────────
  await collection('order_items', 'list', '{{product_name}}')
  await field('order_items', 'product_name', 'string', {}, { interface: 'input' })
  await field('order_items', 'variant_name', 'string', {}, { interface: 'input' })
  await field('order_items', 'sku', 'string', {}, { interface: 'input' })
  await field('order_items', 'unit_price', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('order_items', 'quantity', 'integer', {}, { interface: 'input' })
  await field('order_items', 'download_token', 'string', { is_nullable: true, is_unique: true }, { interface: 'input' })
  await field('order_items', 'download_count', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('order_items', 'download_limit', 'integer', { default_value: 3 }, { interface: 'input' })
  await field('order_items', 'download_expires_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('order_items', 'order_id', 'integer', { is_nullable: true }, { interface: 'input', hidden: true })

  // ── coupons ───────────────────────────────────────────────────────────────
  await collection('coupons', 'local_offer', '{{code}} ({{type}}: {{value}})')
  await field('coupons', 'code', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('coupons', 'type', 'string', {}, { interface: 'select-dropdown', options: { choices: [{ text: 'Percentuale', value: 'percent' }, { text: 'Importo fisso', value: 'fixed' }] } })
  await field('coupons', 'value', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('coupons', 'min_order_amount', 'decimal', { numeric_precision: 10, numeric_scale: 2, is_nullable: true }, { interface: 'input' })
  await field('coupons', 'max_uses', 'integer', { is_nullable: true }, { interface: 'input' })
  await field('coupons', 'used_count', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('coupons', 'expires_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('coupons', 'stripe_coupon_id', 'string', { is_nullable: true }, { interface: 'input' })
  await field('coupons', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })
  await field('coupons', 'description', 'string', { is_nullable: true }, { interface: 'input' })
  await field('coupons', 'date_created', 'timestamp', { is_nullable: true }, { interface: 'datetime', readonly: true, hidden: true, special: ['date-created'] })

  // ── gift_cards ────────────────────────────────────────────────────────────
  await collection('gift_cards', 'card_giftcard', '{{code}} — {{remaining_value}}€')
  await field('gift_cards', 'code', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('gift_cards', 'initial_value', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('gift_cards', 'remaining_value', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('gift_cards', 'expires_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('gift_cards', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })
  await field('gift_cards', 'redemptions', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })

  // ── shipping_zones ────────────────────────────────────────────────────────
  await collection('shipping_zones', 'local_shipping', '{{name}}')
  await field('shipping_zones', 'name', 'string', {}, { interface: 'input', required: true })
  await field('shipping_zones', 'countries', 'json', {}, { interface: 'input-code', options: { language: 'json' } })
  await field('shipping_zones', 'base_rate', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('shipping_zones', 'free_shipping_threshold', 'decimal', { numeric_precision: 10, numeric_scale: 2, is_nullable: true }, { interface: 'input' })
  await field('shipping_zones', 'rate_per_kg', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('shipping_zones', 'max_weight_g', 'integer', { is_nullable: true }, { interface: 'input' })
  await field('shipping_zones', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })

  // ── contact_submissions ───────────────────────────────────────────────────
  await collection('contact_submissions', 'mail', '{{name}} — {{subject}}')
  await field('contact_submissions', 'name', 'string', { is_nullable: false }, { interface: 'input' })
  await field('contact_submissions', 'email', 'string', { is_nullable: false }, { interface: 'input' })
  await field('contact_submissions', 'phone', 'string', { is_nullable: true }, { interface: 'input' })
  await field('contact_submissions', 'subject', 'string', { is_nullable: false }, { interface: 'input' })
  await field('contact_submissions', 'message', 'text', { is_nullable: false }, { interface: 'input-multiline' })
  await field('contact_submissions', 'status', 'string', { default_value: 'new' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Nuovo', value: 'new' }, { text: 'Letto', value: 'read' }, { text: 'Risposto', value: 'replied' }, { text: 'Archiviato', value: 'archived' }] } })
  await field('contact_submissions', 'ip_address', 'string', { is_nullable: true }, { interface: 'input', hidden: true })
  await field('contact_submissions', 'notes', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── stock_notifications ────────────────────────────────────────────────────
  await collection('stock_notifications', 'notifications', '{{email}} — {{product_id}}')
  await field('stock_notifications', 'email', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('stock_notifications', 'product_id', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('stock_notifications', 'variant_id', 'string', { is_nullable: true }, { interface: 'input' })
  await field('stock_notifications', 'notified_at', 'timestamp', { is_nullable: true }, { interface: 'datetime' })

  // ── CMS: categories (blog) ────────────────────────────────────────────────
  await collection('categories', 'folder', '{{name}}')
  await field('categories', 'name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('categories', 'slug', 'string', { is_unique: true }, { interface: 'input', required: true })

  // ── CMS: posts ────────────────────────────────────────────────────────────
  await collection('posts', 'article', '{{title}}')
  await field('posts', 'title', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('posts', 'slug', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('posts', 'status', 'string', { default_value: 'draft' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Pubblicato', value: 'published' }, { text: 'Bozza', value: 'draft' }] } })
  await field('posts', 'published_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('posts', 'excerpt', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('posts', 'content', 'text', { is_nullable: true }, { interface: 'input-rich-text-html' })
  await field('posts', 'seo_title', 'string', { is_nullable: true }, { interface: 'input' })
  await field('posts', 'seo_description', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('posts', 'title_en', 'string', { is_nullable: true }, { interface: 'input' })
  await field('posts', 'excerpt_en', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('posts', 'content_en', 'text', { is_nullable: true }, { interface: 'input-rich-text-html' })
  await field('posts', 'seo_title_en', 'string', { is_nullable: true }, { interface: 'input' })
  await field('posts', 'seo_description_en', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('posts', 'category', 'integer', { is_nullable: true }, { interface: 'input', hidden: true })

  // ── CMS: pages ────────────────────────────────────────────────────────────
  await collection('pages', 'web', '{{title}}')
  await field('pages', 'title', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('pages', 'slug', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('pages', 'status', 'string', { default_value: 'draft' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Pubblicato', value: 'published' }, { text: 'Bozza', value: 'draft' }] } })
  await field('pages', 'blocks', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })
  await field('pages', 'seo_title', 'string', { is_nullable: true }, { interface: 'input' })
  await field('pages', 'seo_description', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── CMS: portfolio ────────────────────────────────────────────────────────
  await collection('portfolio', 'cases', '{{title}}')
  await field('portfolio', 'title', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('portfolio', 'slug', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('portfolio', 'status', 'string', { default_value: 'draft' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Pubblicato', value: 'published' }, { text: 'Bozza', value: 'draft' }] } })
  await field('portfolio', 'description', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('portfolio', 'client', 'string', { is_nullable: true }, { interface: 'input' })
  await field('portfolio', 'year', 'integer', { is_nullable: true }, { interface: 'input' })
  await field('portfolio', 'tags', 'json', { is_nullable: true }, { interface: 'tags' })
  await field('portfolio', 'title_en', 'string', { is_nullable: true }, { interface: 'input' })
  await field('portfolio', 'description_en', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── CMS: faq ──────────────────────────────────────────────────────────────
  await collection('faq', 'help', '{{question}}')
  await field('faq', 'question', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('faq', 'answer', 'text', { is_nullable: false }, { interface: 'input-multiline', required: true })
  await field('faq', 'category', 'string', { is_nullable: true }, { interface: 'input' })
  await field('faq', 'sort_order', 'integer', { is_nullable: true, default_value: 0 }, { interface: 'input' })
  await field('faq', 'question_en', 'string', { is_nullable: true }, { interface: 'input' })
  await field('faq', 'answer_en', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── CMS: site_settings (singleton) ────────────────────────────────────────
  await safe(() => client.request(createCollection({
    collection: 'site_settings',
    meta: { icon: 'settings', singleton: true, display_template: 'Impostazioni sito' },
  })), 'collection: site_settings')
  await field('site_settings', 'site_name', 'string', { is_nullable: true }, { interface: 'input' })
  await field('site_settings', 'footer_text', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('site_settings', 'nav_links', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })
  await field('site_settings', 'social', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })

  // ── contact_documents ────────────────────────────────────────────────────
  await collection('contact_documents', 'description', '{{label}}')
  await field('contact_documents', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('contact_documents', 'directus_file_id', 'uuid', { is_nullable: true }, { interface: 'file', note: 'FK → directus_files' })
  await field('contact_documents', 'label', 'string', { is_nullable: true }, { interface: 'input' })
  await field('contact_documents', 'date_created', 'timestamp', { is_nullable: true }, { interface: 'datetime', readonly: true, hidden: true, special: ['date-created'] })

  // ── contacts (CRM) ───────────────────────────────────────────────────────
  await collection('contacts', 'people', '{{first_name}} {{last_name}}')
  await field('contacts', 'first_name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('contacts', 'last_name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('contacts', 'email', 'string', { is_nullable: true }, { interface: 'input' })
  await field('contacts', 'phone', 'string', { is_nullable: true }, { interface: 'input' })
  await field('contacts', 'date_of_birth', 'date', { is_nullable: true }, { interface: 'datetime' })
  await field('contacts', 'pipeline_stage', 'string', { default_value: 'lead' }, { interface: 'select-dropdown', options: { choices: [
    { text: 'Lead', value: 'lead' }, { text: 'Prospect', value: 'prospect' },
    { text: 'Attivo', value: 'cliente_attivo' }, { text: 'Fidelizzato', value: 'cliente_fidelizzato' },
    { text: 'Inattivo', value: 'inattivo' },
  ] } })
  await field('contacts', 'canale_prevalente', 'string', { default_value: 'offline' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Offline', value: 'offline' }, { text: 'Online', value: 'online' }] } })
  await field('contacts', 'channel_type', 'string', { default_value: 'offline' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Offline', value: 'offline' }, { text: 'Online', value: 'online' }, { text: 'Entrambi', value: 'both' }] } })
  await field('contacts', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })
  await field('contacts', 'stripe_customer_id', 'string', { is_nullable: true }, { interface: 'input' })
  await field('contacts', 'user_id', 'string', { is_nullable: true }, { interface: 'input', note: 'FK → directus_users' })
  await field('contacts', 'shipping_addresses', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })
  await field('contacts', 'default_shipping_address', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })
  await field('contacts', 'tags', 'json', { is_nullable: true }, { interface: 'tags' })
  await field('contacts', 'date_created', 'timestamp', { is_nullable: true }, { interface: 'datetime', readonly: true, hidden: true, special: ['date-created'] })
  await field('contacts', 'date_updated', 'timestamp', { is_nullable: true }, { interface: 'datetime', readonly: true, hidden: true, special: ['date-updated'] })

  // ── crm_interactions ─────────────────────────────────────────────────────
  await collection('crm_interactions', 'forum', '{{type}} — {{date}}')
  await field('crm_interactions', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('crm_interactions', 'type', 'string', { default_value: 'note' }, { interface: 'select-dropdown', options: { choices: [
    { text: 'Telefonata', value: 'call' }, { text: 'Visita', value: 'visit' }, { text: 'Email', value: 'email' },
    { text: 'WhatsApp', value: 'whatsapp' }, { text: 'Nota', value: 'note' }, { text: 'Altro', value: 'other' },
  ] } })
  await field('crm_interactions', 'date', 'dateTime', { is_nullable: false }, { interface: 'datetime' })
  await field('crm_interactions', 'subject', 'string', { is_nullable: true }, { interface: 'input' })
  await field('crm_interactions', 'body', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('crm_interactions', 'outcome', 'string', { is_nullable: true }, { interface: 'input' })
  await field('crm_interactions', 'staff_id', 'string', { is_nullable: true }, { interface: 'input' })

  // ── crm_tasks ─────────────────────────────────────────────────────────────
  await collection('crm_tasks', 'task', '{{title}}')
  await field('crm_tasks', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('crm_tasks', 'title', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('crm_tasks', 'due_date', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('crm_tasks', 'status', 'string', { default_value: 'pending' }, { interface: 'select-dropdown', options: { choices: [
    { text: 'In attesa', value: 'pending' }, { text: 'In corso', value: 'in_progress' },
    { text: 'Completato', value: 'done' }, { text: 'Annullato', value: 'cancelled' },
  ] } })
  await field('crm_tasks', 'priority', 'string', { default_value: 'medium' }, { interface: 'select-dropdown', options: { choices: [
    { text: 'Bassa', value: 'low' }, { text: 'Media', value: 'medium' }, { text: 'Alta', value: 'high' },
  ] } })
  await field('crm_tasks', 'notes', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── customer_kpis ─────────────────────────────────────────────────────────
  await collection('customer_kpis', 'analytics', '{{contact_id}}')
  await field('customer_kpis', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('customer_kpis', 'clv', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'churn_score', 'decimal', { numeric_precision: 5, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'lead_score', 'decimal', { numeric_precision: 5, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'total_spent_online', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'total_spent_offline', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'total_orders_online', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'total_orders_offline', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'last_purchase_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('customer_kpis', 'avg_order_value', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'preferred_channel', 'string', { is_nullable: true }, { interface: 'input' })
  await field('customer_kpis', 'rfm_segment', 'string', { is_nullable: true }, { interface: 'input' })
  await field('customer_kpis', 'calculated_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })

  // ── forms ─────────────────────────────────────────────────────────────────
  await collection('forms', 'dynamic_form', '{{name}}')
  await field('forms', 'name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('forms', 'slug', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('forms', 'fields', 'json', { is_nullable: true, default_value: '[]' }, { interface: 'input-code', options: { language: 'json' } })
  await field('forms', 'success_message', 'text', { is_nullable: true }, { interface: 'input-multiline' })
  await field('forms', 'redirect_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'redirect_url', 'string', { is_nullable: true }, { interface: 'input' })
  await field('forms', 'notification_email', 'string', { is_nullable: true }, { interface: 'input' })
  await field('forms', 'recaptcha_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'capture_ip', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'capture_user_agent', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'capture_page_url', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'honeypot_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'country_filter_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'allowed_countries', 'json', { is_nullable: true }, { interface: 'tags' })
  await field('forms', 'keyword_filter_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'blocked_keywords', 'json', { is_nullable: true }, { interface: 'tags' })
  await field('forms', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })

  // ── form_submissions ──────────────────────────────────────────────────────
  await collection('form_submissions', 'inbox', '{{form_id}} — {{date_created}}')
  await field('form_submissions', 'form_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('form_submissions', 'data', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })
  await field('form_submissions', 'page_url', 'string', { is_nullable: true }, { interface: 'input' })
  await field('form_submissions', 'ip_address', 'string', { is_nullable: true }, { interface: 'input' })
  await field('form_submissions', 'user_agent', 'string', { is_nullable: true }, { interface: 'input' })
  await field('form_submissions', 'country_code', 'string', { is_nullable: true }, { interface: 'input' })
  await field('form_submissions', 'is_read', 'boolean', { default_value: false }, { interface: 'boolean' })

  // ── pages_blocks (page builder junction) ─────────────────────────────────
  await collection('pages_blocks', 'view_module', '{{block_type}} — {{sort}}')
  await field('pages_blocks', 'page_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('pages_blocks', 'block_type', 'string', { is_nullable: false }, { interface: 'input' })
  await field('pages_blocks', 'block_id', 'string', { is_nullable: false }, { interface: 'input' })
  await field('pages_blocks', 'sort', 'integer', { default_value: 0 }, { interface: 'input' })

  // ── Relations ─────────────────────────────────────────────────────────────
  console.log('\nCreazione relazioni FK...')
  await safe(() => client.request(createRelation({
    collection: 'product_variants',
    field: 'product_id',
    related_collection: 'products',
    meta: { many_collection: 'product_variants', many_field: 'product_id', one_collection: 'products', one_field: 'variants' },
    schema: { on_delete: 'CASCADE' },
  })), 'relation: product_variants.product_id → products')

  await safe(() => client.request(createRelation({
    collection: 'products',
    field: 'category_id',
    related_collection: 'product_categories',
    schema: {},
  })), 'relation: products.category_id → product_categories')

  await safe(() => client.request(createRelation({
    collection: 'order_items',
    field: 'order_id',
    related_collection: 'orders',
    meta: { many_collection: 'order_items', many_field: 'order_id', one_collection: 'orders', one_field: 'order_items' },
    schema: { on_delete: 'CASCADE' },
  })), 'relation: order_items.order_id → orders')

  await safe(() => client.request(createRelation({
    collection: 'posts',
    field: 'category',
    related_collection: 'categories',
    schema: {},
  })), 'relation: posts.category → categories')

  await safe(() => client.request(createRelation({
    collection: 'contact_documents',
    field: 'contact_id',
    related_collection: 'contacts',
    meta: { many_collection: 'contact_documents', many_field: 'contact_id', one_collection: 'contacts' },
    schema: { on_delete: 'CASCADE' },
  })), 'relation: contact_documents.contact_id → contacts')

  await safe(() => client.request(createRelation({
    collection: 'contact_documents',
    field: 'directus_file_id',
    related_collection: 'directus_files',
    meta: { many_collection: 'contact_documents', many_field: 'directus_file_id', one_collection: 'directus_files' },
    schema: { on_delete: 'SET NULL' },
  })), 'relation: contact_documents.directus_file_id → directus_files')

  await safe(() => client.request(createRelation({
    collection: 'crm_interactions',
    field: 'contact_id',
    related_collection: 'contacts',
    meta: { many_collection: 'crm_interactions', many_field: 'contact_id', one_collection: 'contacts' },
    schema: { on_delete: 'CASCADE' },
  })), 'relation: crm_interactions.contact_id → contacts')

  await safe(() => client.request(createRelation({
    collection: 'crm_tasks',
    field: 'contact_id',
    related_collection: 'contacts',
    meta: { many_collection: 'crm_tasks', many_field: 'contact_id', one_collection: 'contacts' },
    schema: { on_delete: 'CASCADE' },
  })), 'relation: crm_tasks.contact_id → contacts')

  await safe(() => client.request(createRelation({
    collection: 'customer_kpis',
    field: 'contact_id',
    related_collection: 'contacts',
    schema: { on_delete: 'CASCADE' },
  })), 'relation: customer_kpis.contact_id → contacts')

  await safe(() => client.request(createRelation({
    collection: 'form_submissions',
    field: 'form_id',
    related_collection: 'forms',
    meta: { many_collection: 'form_submissions', many_field: 'form_id', one_collection: 'forms' },
    schema: { on_delete: 'CASCADE' },
  })), 'relation: form_submissions.form_id → forms')

  await safe(() => client.request(createRelation({
    collection: 'pages_blocks',
    field: 'page_id',
    related_collection: 'pages',
    meta: { many_collection: 'pages_blocks', many_field: 'page_id', one_collection: 'pages' },
    schema: { on_delete: 'CASCADE' },
  })), 'relation: pages_blocks.page_id → pages')

  console.log('\n✓ Setup completato!\n')
  console.log('Passaggi manuali rimanenti (dall\'admin Directus):')
  console.log('  1. product_variants.digital_file → M2O directus_files')
  console.log('  2. product_variants.image_id → M2O directus_files')
  console.log('  3. products.images → M2M directus_files (junction: products_files)')
  console.log('  4. product_categories.image → M2O directus_files')
  console.log('  5. posts.cover → M2O directus_files')
  console.log('  6. portfolio.cover → M2O directus_files')
  console.log('  7. portfolio.gallery → M2M directus_files')
  console.log('  8. site_settings.logo → M2O directus_files')
  console.log('  9. orders.coupon_id → M2O coupons')
  console.log(' 10. orders.gift_card_id → M2O gift_cards')
  console.log(' 11. Permessi ruolo Public: Read su products, product_variants, product_categories')
  console.log(' 12. Permessi ruolo Public: Read su pages, posts, categories, portfolio, faq, site_settings')
}

main().catch(err => { console.error(err); process.exit(1) })
