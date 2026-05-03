// scripts/setup-collections.mjs
// Crea tutte le collezioni e-commerce su Directus
// Usage: DIRECTUS_TOKEN=xxx node scripts/setup-collections.mjs

import { createDirectus, rest, staticToken, createCollection, createField, createRelation } from '@directus/sdk'

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
    if (msg.includes('already exists') || msg.includes('RECORD_NOT_UNIQUE') || msg.includes('duplicate')) {
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
  await field('product_variants', 'download_limit', 'integer', { default_value: 3 }, { interface: 'input' })
  await field('product_variants', 'download_expires_hours', 'integer', { default_value: 168 }, { interface: 'input' })
  await field('product_variants', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })

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

  // ── gift_cards ────────────────────────────────────────────────────────────
  await collection('gift_cards', 'card_giftcard', '{{code}} — {{remaining_value}}€')
  await field('gift_cards', 'code', 'string', { is_unique: true }, { interface: 'input', required: true })
  await field('gift_cards', 'initial_value', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('gift_cards', 'remaining_value', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('gift_cards', 'expires_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('gift_cards', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })
  await field('gift_cards', 'redemptions', 'json', { default_value: '[]' }, { interface: 'input-code', options: { language: 'json' } })

  // ── shipping_zones ────────────────────────────────────────────────────────
  await collection('shipping_zones', 'local_shipping', '{{name}}')
  await field('shipping_zones', 'name', 'string', {}, { interface: 'input', required: true })
  await field('shipping_zones', 'countries', 'json', {}, { interface: 'input-code', options: { language: 'json' } })
  await field('shipping_zones', 'base_rate', 'decimal', { numeric_precision: 10, numeric_scale: 2 }, { interface: 'input' })
  await field('shipping_zones', 'free_shipping_threshold', 'decimal', { numeric_precision: 10, numeric_scale: 2, is_nullable: true }, { interface: 'input' })
  await field('shipping_zones', 'rate_per_kg', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('shipping_zones', 'max_weight_g', 'integer', { is_nullable: true }, { interface: 'input' })
  await field('shipping_zones', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })

  // ── customers ─────────────────────────────────────────────────────────────
  await collection('customers', 'person', '{{first_name}} {{last_name}}')
  await field('customers', 'first_name', 'string', {}, { interface: 'input' })
  await field('customers', 'last_name', 'string', {}, { interface: 'input' })
  await field('customers', 'phone', 'string', { is_nullable: true }, { interface: 'input' })
  await field('customers', 'default_shipping_address', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })
  await field('customers', 'stripe_customer_id', 'string', { is_nullable: true }, { interface: 'input' })
  await field('customers', 'total_orders', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('customers', 'total_spent', 'decimal', { numeric_precision: 12, numeric_scale: 2, default_value: 0 }, { interface: 'input' })

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

  console.log('\n✓ Setup completato!\n')
  console.log('Passaggi manuali rimanenti (dall\'admin Directus):')
  console.log('  1. product_variants.digital_file → M2O directus_files')
  console.log('  2. product_variants.image_id → M2O directus_files')
  console.log('  3. products.images → M2M directus_files (junction: products_files)')
  console.log('  4. product_categories.image → M2O directus_files')
  console.log('  5. customers.directus_user_id → M2O directus_users')
  console.log('  6. orders.customer_id → M2O customers')
  console.log('  7. orders.coupon_id → M2O coupons')
  console.log('  8. orders.gift_card_id → M2O gift_cards')
  console.log('  9. Permessi ruolo Public: Read su products, product_variants, product_categories')
  console.log(' 10. Permessi ruolo Public: Read su pages, posts, faq, site_settings')
}

main().catch(err => { console.error(err); process.exit(1) })
