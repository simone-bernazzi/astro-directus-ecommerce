# E-commerce Template — Piano 1: Foundation + Catalogo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare la struttura base del template e-commerce con catalogo prodotti SSG navigabile, collezioni Directus configurate e connessione Stripe pronta.

**Architecture:** Astro 5 Hybrid (SSG per catalogo, SSR per account) + Tailwind CSS v4 + GSAP + Lenis. Directus come headless CMS/OMS su cPanel. Prodotti generati staticamente a build time, pagine account server-rendered.

**Tech Stack:** Astro 5, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), GSAP 3 + SplitText + Lenis, @directus/sdk v21 (`staticToken`), Stripe SDK v15, Zod v3, Nanostores, Vitest, Node 22, Netlify.

---

## Struttura File (questo piano)

```
astro-directus-ecommerce/
├── src/
│   ├── animations/
│   │   ├── gsap.ts                    # GSAP + ScrollTrigger + Lenis init
│   │   └── presets.ts                 # fadeUp, staggerIn, splitTitle, parallax
│   ├── components/
│   │   ├── blocks/
│   │   │   ├── Hero.astro
│   │   │   ├── Features.astro
│   │   │   ├── CTA.astro
│   │   │   └── FaqAccordion.astro
│   │   ├── shop/
│   │   │   ├── ProductGrid.astro      # Griglia prodotti
│   │   │   └── ProductCard.astro      # Card singolo prodotto
│   │   ├── layout/
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   └── Nav.astro
│   │   └── ui/
│   │       ├── Button.astro
│   │       ├── Card.astro
│   │       └── Badge.astro
│   ├── layouts/
│   │   ├── Base.astro
│   │   ├── Page.astro
│   │   └── Post.astro
│   ├── lib/
│   │   ├── directus.ts                # Client + query helpers estesi
│   │   ├── types.ts                   # Tutti i tipi Directus e-commerce
│   │   └── directus.test.ts           # Test helpers
│   ├── pages/
│   │   ├── index.astro                # Homepage SSG
│   │   ├── [slug].astro               # Pagine CMS dinamiche SSG
│   │   ├── negozio/
│   │   │   ├── index.astro            # Shop index SSG
│   │   │   ├── [categoria].astro      # Categoria SSG
│   │   │   └── [slug].astro           # PDP prodotto SSG
│   │   └── blog/
│   │       ├── index.astro
│   │       └── [slug].astro
│   └── styles/
│       ├── theme.css
│       └── global.css
├── scripts/
│   └── setup-collections.mjs          # Crea tutte le collezioni Directus
├── public/
├── .env.example
├── .nvmrc
├── astro.config.mjs
├── netlify.toml
├── package.json
└── tsconfig.json
```

---

## Task 1: Setup progetto Astro

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `.nvmrc`
- Create: `netlify.toml`

- [ ] **Step 1.1: Inizializza repo Git**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git init
echo "22" > .nvmrc
nvm use 22
```

- [ ] **Step 1.2: Crea `package.json`**

```json
{
  "name": "astro-directus-ecommerce",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/netlify": "^6.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "@directus/sdk": "^21.0.0",
    "stripe": "^15.0.0",
    "gsap": "^3.12.0",
    "lenis": "^1.3.0",
    "nanostores": "^0.11.0",
    "@nanostores/persistent": "^0.10.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 1.3: Installa dipendenze**

```bash
npm install
```

Verifica: nessun errore. Node version: 22.x.

- [ ] **Step 1.4: Crea `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'hybrid',
  adapter: netlify(),
  integrations: [],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
```

- [ ] **Step 1.5: Crea `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 1.6: Crea `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

[dev]
  command = "npm run dev"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' js.stripe.com; frame-src js.stripe.com; connect-src 'self' api.stripe.com"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

- [ ] **Step 1.7: Crea `.env.example`**

```bash
# Directus
DIRECTUS_URL=https://cms.tuodominio.it
DIRECTUS_TOKEN=your_directus_token

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# App
PUBLIC_SITE_URL=https://tuodominio.it
ALLOWED_ORIGIN=https://tuodominio.it
DEFAULT_LOCALE=it

# Email (opzionale)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

```bash
cp .env.example .env
```

- [ ] **Step 1.8: Commit**

```bash
git add .
git commit -m "feat: initial Astro hybrid project setup"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/types.test.ts`

- [ ] **Step 2.1: Crea `src/lib/types.ts`**

```typescript
// ─── Shared ─────────────────────────────────────────────────────────────────

export interface Translation {
  languages_code: string;
  [key: string]: string | null;
}

// ─── CMS (ereditati dal template base) ──────────────────────────────────────

export interface SiteSettings {
  site_name: string;
  logo: string | null;
  nav_links: { label: string; url: string }[];
  social: { platform: string; url: string }[];
  footer_text: string | null;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  blocks: Block[] | null;
  seo_title: string | null;
  seo_description: string | null;
}

export interface Block {
  type: string;
  [key: string]: unknown;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover: string | null;
  category: Category | null;
  published_at: string;
  seo_title: string | null;
  seo_description: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

// ─── E-commerce ─────────────────────────────────────────────────────────────

export type ProductType = 'physical' | 'digital';

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: ProductCategory | null;
  description: string | null;
  image: string | null;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  translations?: Translation[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  option_1_name: string | null;
  option_1_value: string | null;
  option_2_name: string | null;
  option_2_value: string | null;
  price_override: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  stripe_price_id: string;
  digital_file: string | null;
  download_limit: number;
  download_expires_hours: number;
  image_id: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: ProductType;
  base_price: number;
  compare_price: number | null;
  images: { directus_files_id: string }[];
  category_id: ProductCategory | null;
  stripe_product_id: string;
  weight_g: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  is_active: boolean;
  featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  tags: { tags_id: string }[];
  variants: ProductVariant[];
  translations?: Translation[];
}

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  base_rate: number;
  free_shipping_threshold: number | null;
  rate_per_kg: number;
  max_weight_g: number;
  is_active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  stripe_coupon_id: string;
  is_active: boolean;
  description: string | null;
}

export interface GiftCard {
  id: string;
  code: string;
  initial_value: number;
  remaining_value: number;
  expires_at: string | null;
  is_active: boolean;
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'refunded';

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  download_token: string | null;
  download_count: number;
  download_limit: number;
  download_expires_at: string | null;
}

export interface Order {
  id: string;
  stripe_session_id: string;
  status: OrderStatus;
  customer_email: string;
  customer_name: string;
  customer_id: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_cost: number;
  total: number;
  coupon_id: string | null;
  gift_card_id: string | null;
  gift_card_amount_used: number | null;
  shipping_address: ShippingAddress;
  shipping_zone_id: string | null;
  items: OrderItemSnapshot[];
  order_items?: OrderItem[];
  date_created: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  postal_code: string;
  state: string;
  country: string;
}

export interface OrderItemSnapshot {
  product_name: string;
  variant_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
}

export interface Customer {
  id: string;
  directus_user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  default_shipping_address: ShippingAddress | null;
  stripe_customer_id: string | null;
  total_orders: number;
  total_spent: number;
}

// ─── Cart (client-side) ──────────────────────────────────────────────────────

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
  image: string | null;
  type: ProductType;
  weightG: number;
}
```

- [ ] **Step 2.2: Crea `src/lib/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import type { Product, ProductVariant, CartItem } from './types';

describe('types', () => {
  it('CartItem has required e-commerce fields', () => {
    const item: CartItem = {
      variantId: 'v1',
      productId: 'p1',
      productName: 'Test',
      variantName: 'Default',
      sku: 'SKU-001',
      price: 29.99,
      quantity: 1,
      image: null,
      type: 'physical',
      weightG: 500,
    };
    expect(item.price).toBe(29.99);
    expect(item.type).toBe('physical');
  });

  it('ProductType accepts physical and digital', () => {
    const physical: Product['type'] = 'physical';
    const digital: Product['type'] = 'digital';
    expect(physical).toBe('physical');
    expect(digital).toBe('digital');
  });
});
```

- [ ] **Step 2.3: Esegui test**

```bash
npm test
```

Expected: PASS (2 tests).

- [ ] **Step 2.4: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat: add TypeScript types for e-commerce"
```

---

## Task 3: Directus Client

**Files:**
- Create: `src/lib/directus.ts`
- Create: `src/lib/directus.test.ts`

- [ ] **Step 3.1: Crea `src/lib/directus.ts`**

```typescript
import { createDirectus, rest, staticToken, readItems, readItem, readSingleton } from '@directus/sdk';
import type {
  Product, ProductCategory, ProductVariant, Post, Category,
  Page, SiteSettings, ShippingZone, Coupon, GiftCard, Order
} from './types';

function getRequiredEnv(key: string): string {
  const value = import.meta.env[key] ?? process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export function createClient() {
  return createDirectus(getRequiredEnv('DIRECTUS_URL'))
    .with(staticToken(getRequiredEnv('DIRECTUS_TOKEN')))
    .with(rest());
}

const client = createClient();

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(options?: { featured?: boolean; categorySlug?: string }): Promise<Product[]> {
  const filter: Record<string, unknown> = { is_active: { _eq: true } };
  if (options?.featured) filter.featured = { _eq: true };

  const items = await client.request(
    readItems('products', {
      filter,
      fields: [
        '*',
        { images: ['directus_files_id'] },
        { category_id: ['id', 'name', 'slug'] },
        { variants: ['*'] },
        { translations: ['*'] },
      ],
      sort: ['sort_order'],
    })
  );
  return items as Product[];
}

export async function getProduct(slug: string): Promise<Product | null> {
  const items = await client.request(
    readItems('products', {
      filter: { slug: { _eq: slug }, is_active: { _eq: true } },
      fields: [
        '*',
        { images: ['directus_files_id'] },
        { category_id: ['id', 'name', 'slug'] },
        { variants: ['*'] },
        { translations: ['*'] },
      ],
      limit: 1,
    })
  );
  return (items as Product[])[0] ?? null;
}

export async function getProductSlugs(): Promise<{ slug: string }[]> {
  const items = await client.request(
    readItems('products', {
      filter: { is_active: { _eq: true } },
      fields: ['slug'],
    })
  );
  return items as { slug: string }[];
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getProductCategories(): Promise<ProductCategory[]> {
  const items = await client.request(
    readItems('product_categories', {
      fields: ['*', { parent_id: ['id', 'name', 'slug'] }, { translations: ['*'] }],
      sort: ['sort_order'],
    })
  );
  return items as ProductCategory[];
}

export async function getProductCategory(slug: string): Promise<ProductCategory | null> {
  const items = await client.request(
    readItems('product_categories', {
      filter: { slug: { _eq: slug } },
      fields: ['*', { translations: ['*'] }],
      limit: 1,
    })
  );
  return (items as ProductCategory[])[0] ?? null;
}

// ─── CMS (ereditati dal template base) ──────────────────────────────────────

export async function getPosts(): Promise<Post[]> {
  const items = await client.request(
    readItems('posts', {
      filter: { status: { _eq: 'published' } },
      fields: ['*', { category: ['id', 'name', 'slug'] }, { translations: ['*'] }],
      sort: ['-published_at'],
    })
  );
  return items as Post[];
}

export async function getPost(slug: string): Promise<Post | null> {
  const items = await client.request(
    readItems('posts', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      fields: ['*', { category: ['id', 'name', 'slug'] }, { translations: ['*'] }],
      limit: 1,
    })
  );
  return (items as Post[])[0] ?? null;
}

export async function getPage(slug: string): Promise<Page | null> {
  const items = await client.request(
    readItems('pages', {
      filter: { slug: { _eq: slug } },
      fields: ['*', { translations: ['*'] }],
      limit: 1,
    })
  );
  return (items as Page[])[0] ?? null;
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const item = await client.request(readSingleton('site_settings', { fields: ['*'] }));
    return item as SiteSettings;
  } catch {
    return null;
  }
}

// ─── Commerce ────────────────────────────────────────────────────────────────

export async function getShippingZones(): Promise<ShippingZone[]> {
  const items = await client.request(
    readItems('shipping_zones', {
      filter: { is_active: { _eq: true } },
      fields: ['*'],
    })
  );
  return items as ShippingZone[];
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const items = await client.request(
    readItems('coupons', {
      filter: { code: { _icontains: code }, is_active: { _eq: true } },
      fields: ['*'],
      limit: 1,
    })
  );
  return (items as Coupon[])[0] ?? null;
}

export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  const items = await client.request(
    readItems('gift_cards', {
      filter: { code: { _eq: code }, is_active: { _eq: true } },
      fields: ['id', 'code', 'initial_value', 'remaining_value', 'expires_at', 'is_active'],
      limit: 1,
    })
  );
  return (items as GiftCard[])[0] ?? null;
}

export async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  const items = await client.request(
    readItems('orders', {
      filter: { customer_id: { _eq: customerId } },
      fields: ['*', { order_items: ['*'] }],
      sort: ['-date_created'],
    })
  );
  return items as Order[];
}

export async function getOrderById(id: string): Promise<Order | null> {
  try {
    const item = await client.request(
      readItem('orders', id, { fields: ['*', { order_items: ['*'] }] })
    );
    return item as Order;
  } catch {
    return null;
  }
}

// ─── Asset URL helper ────────────────────────────────────────────────────────

export function assetUrl(fileId: string | null): string | null {
  if (!fileId) return null;
  const base = import.meta.env.DIRECTUS_URL ?? process.env.DIRECTUS_URL ?? '';
  return `${base}/assets/${fileId}`;
}
```

- [ ] **Step 3.2: Crea `src/lib/directus.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { assetUrl } from './directus';

describe('assetUrl', () => {
  it('returns null for null input', () => {
    expect(assetUrl(null)).toBeNull();
  });

  it('constructs asset URL from file ID', () => {
    process.env.DIRECTUS_URL = 'https://cms.example.com';
    const url = assetUrl('abc-123');
    expect(url).toBe('https://cms.example.com/assets/abc-123');
  });
});
```

- [ ] **Step 3.3: Esegui test**

```bash
npm test
```

Expected: PASS (4 tests totali).

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/directus.ts src/lib/directus.test.ts
git commit -m "feat: add Directus client with e-commerce query helpers"
```

---

## Task 4: Script Setup Collezioni Directus

**Files:**
- Create: `scripts/setup-collections.mjs`

- [ ] **Step 4.1: Crea `scripts/setup-collections.mjs`**

```javascript
import { createDirectus, rest, staticToken } from '@directus/sdk';
import { createCollection, createField, createRelation } from '@directus/sdk';

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? 'http://directus-cms.ddev.site:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

if (!DIRECTUS_TOKEN) {
  console.error('DIRECTUS_TOKEN non impostato');
  process.exit(1);
}

const client = createDirectus(DIRECTUS_URL)
  .with(staticToken(DIRECTUS_TOKEN))
  .with(rest());

async function safeCreate(fn, label) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (e) {
    if (e?.errors?.[0]?.message?.includes('already exists') || e?.errors?.[0]?.extensions?.code === 'RECORD_NOT_UNIQUE') {
      console.log(`  (già esistente) ${label}`);
    } else {
      console.error(`✗ ${label}:`, e?.errors?.[0]?.message ?? e.message);
    }
  }
}

async function main() {
  console.log('Setup collezioni e-commerce Directus...\n');

  // product_categories
  await safeCreate(() => client.request(createCollection({
    collection: 'product_categories',
    meta: { icon: 'category', display_template: '{{name}}' },
    schema: { name: 'product_categories' },
  })), 'collection: product_categories');

  for (const [field, schema, meta] of [
    ['name', { name: 'name', type: 'string', schema: { is_nullable: false } }, { interface: 'input' }],
    ['slug', { name: 'slug', type: 'string', schema: { is_unique: true } }, { interface: 'input' }],
    ['description', { name: 'description', type: 'text' }, { interface: 'input-rich-text-html' }],
    ['sort_order', { name: 'sort_order', type: 'integer', schema: { default_value: 0 } }, { interface: 'input' }],
    ['seo_title', { name: 'seo_title', type: 'string' }, { interface: 'input' }],
    ['seo_description', { name: 'seo_description', type: 'text' }, { interface: 'input-multiline' }],
  ]) {
    await safeCreate(() => client.request(createField('product_categories', { field, ...schema, meta })),
      `field: product_categories.${field}`);
  }

  // products
  await safeCreate(() => client.request(createCollection({
    collection: 'products',
    meta: { icon: 'shopping_bag', display_template: '{{name}}' },
    schema: { name: 'products' },
  })), 'collection: products');

  for (const [field, schema, meta] of [
    ['name', { name: 'name', type: 'string', schema: { is_nullable: false } }, { interface: 'input' }],
    ['slug', { name: 'slug', type: 'string', schema: { is_unique: true } }, { interface: 'input' }],
    ['description', { name: 'description', type: 'text' }, { interface: 'input-rich-text-html' }],
    ['type', { name: 'type', type: 'string', schema: { default_value: 'physical' } }, { interface: 'select-dropdown', options: { choices: [{ text: 'Fisico', value: 'physical' }, { text: 'Digitale', value: 'digital' }] } }],
    ['base_price', { name: 'base_price', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['compare_price', { name: 'compare_price', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2, is_nullable: true } }, { interface: 'input' }],
    ['stripe_product_id', { name: 'stripe_product_id', type: 'string' }, { interface: 'input' }],
    ['weight_g', { name: 'weight_g', type: 'integer', schema: { default_value: 0 } }, { interface: 'input' }],
    ['width_mm', { name: 'width_mm', type: 'integer' }, { interface: 'input' }],
    ['height_mm', { name: 'height_mm', type: 'integer' }, { interface: 'input' }],
    ['depth_mm', { name: 'depth_mm', type: 'integer' }, { interface: 'input' }],
    ['is_active', { name: 'is_active', type: 'boolean', schema: { default_value: true } }, { interface: 'boolean' }],
    ['featured', { name: 'featured', type: 'boolean', schema: { default_value: false } }, { interface: 'boolean' }],
    ['sort_order', { name: 'sort_order', type: 'integer', schema: { default_value: 0 } }, { interface: 'input' }],
    ['seo_title', { name: 'seo_title', type: 'string' }, { interface: 'input' }],
    ['seo_description', { name: 'seo_description', type: 'text' }, { interface: 'input-multiline' }],
  ]) {
    await safeCreate(() => client.request(createField('products', { field, ...schema, meta })),
      `field: products.${field}`);
  }

  // product_variants
  await safeCreate(() => client.request(createCollection({
    collection: 'product_variants',
    meta: { icon: 'tune', display_template: '{{name}} ({{sku}})' },
    schema: { name: 'product_variants' },
  })), 'collection: product_variants');

  for (const [field, schema, meta] of [
    ['sku', { name: 'sku', type: 'string', schema: { is_unique: true } }, { interface: 'input' }],
    ['name', { name: 'name', type: 'string' }, { interface: 'input' }],
    ['option_1_name', { name: 'option_1_name', type: 'string' }, { interface: 'input' }],
    ['option_1_value', { name: 'option_1_value', type: 'string' }, { interface: 'input' }],
    ['option_2_name', { name: 'option_2_name', type: 'string' }, { interface: 'input' }],
    ['option_2_value', { name: 'option_2_value', type: 'string' }, { interface: 'input' }],
    ['price_override', { name: 'price_override', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2, is_nullable: true } }, { interface: 'input' }],
    ['stock_quantity', { name: 'stock_quantity', type: 'integer', schema: { default_value: 0 } }, { interface: 'input' }],
    ['low_stock_threshold', { name: 'low_stock_threshold', type: 'integer', schema: { default_value: 5 } }, { interface: 'input' }],
    ['stripe_price_id', { name: 'stripe_price_id', type: 'string' }, { interface: 'input' }],
    ['download_limit', { name: 'download_limit', type: 'integer', schema: { default_value: 3 } }, { interface: 'input' }],
    ['download_expires_hours', { name: 'download_expires_hours', type: 'integer', schema: { default_value: 168 } }, { interface: 'input' }],
    ['is_active', { name: 'is_active', type: 'boolean', schema: { default_value: true } }, { interface: 'boolean' }],
  ]) {
    await safeCreate(() => client.request(createField('product_variants', { field, ...schema, meta })),
      `field: product_variants.${field}`);
  }

  // orders
  await safeCreate(() => client.request(createCollection({
    collection: 'orders',
    meta: { icon: 'receipt', display_template: '{{customer_email}} — {{total}}€' },
    schema: { name: 'orders' },
  })), 'collection: orders');

  for (const [field, schema, meta] of [
    ['stripe_session_id', { name: 'stripe_session_id', type: 'string', schema: { is_unique: true } }, { interface: 'input' }],
    ['status', { name: 'status', type: 'string', schema: { default_value: 'pending' } }, { interface: 'select-dropdown', options: { choices: ['pending','paid','shipped','delivered','refunded'].map(v => ({ text: v, value: v })) } }],
    ['customer_email', { name: 'customer_email', type: 'string' }, { interface: 'input' }],
    ['customer_name', { name: 'customer_name', type: 'string' }, { interface: 'input' }],
    ['subtotal', { name: 'subtotal', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['discount_amount', { name: 'discount_amount', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2, default_value: 0 } }, { interface: 'input' }],
    ['shipping_cost', { name: 'shipping_cost', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2, default_value: 0 } }, { interface: 'input' }],
    ['total', { name: 'total', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['gift_card_amount_used', { name: 'gift_card_amount_used', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2, default_value: 0 } }, { interface: 'input' }],
    ['shipping_address', { name: 'shipping_address', type: 'json' }, { interface: 'input-code', options: { language: 'json' } }],
    ['items', { name: 'items', type: 'json' }, { interface: 'input-code', options: { language: 'json' } }],
    ['notes', { name: 'notes', type: 'text' }, { interface: 'input-multiline' }],
  ]) {
    await safeCreate(() => client.request(createField('orders', { field, ...schema, meta })),
      `field: orders.${field}`);
  }

  // order_items
  await safeCreate(() => client.request(createCollection({
    collection: 'order_items',
    meta: { icon: 'list', hidden: true },
    schema: { name: 'order_items' },
  })), 'collection: order_items');

  for (const [field, schema, meta] of [
    ['product_name', { name: 'product_name', type: 'string' }, { interface: 'input' }],
    ['variant_name', { name: 'variant_name', type: 'string' }, { interface: 'input' }],
    ['sku', { name: 'sku', type: 'string' }, { interface: 'input' }],
    ['unit_price', { name: 'unit_price', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['quantity', { name: 'quantity', type: 'integer' }, { interface: 'input' }],
    ['download_token', { name: 'download_token', type: 'string', schema: { is_nullable: true } }, { interface: 'input' }],
    ['download_count', { name: 'download_count', type: 'integer', schema: { default_value: 0 } }, { interface: 'input' }],
    ['download_limit', { name: 'download_limit', type: 'integer', schema: { default_value: 3 } }, { interface: 'input' }],
    ['download_expires_at', { name: 'download_expires_at', type: 'dateTime', schema: { is_nullable: true } }, { interface: 'datetime' }],
  ]) {
    await safeCreate(() => client.request(createField('order_items', { field, ...schema, meta })),
      `field: order_items.${field}`);
  }

  // coupons
  await safeCreate(() => client.request(createCollection({
    collection: 'coupons',
    meta: { icon: 'local_offer', display_template: '{{code}} ({{type}}: {{value}})' },
    schema: { name: 'coupons' },
  })), 'collection: coupons');

  for (const [field, schema, meta] of [
    ['code', { name: 'code', type: 'string', schema: { is_unique: true } }, { interface: 'input' }],
    ['type', { name: 'type', type: 'string' }, { interface: 'select-dropdown', options: { choices: [{ text: 'Percentuale', value: 'percent' }, { text: 'Importo fisso', value: 'fixed' }] } }],
    ['value', { name: 'value', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['min_order_amount', { name: 'min_order_amount', type: 'decimal', schema: { is_nullable: true } }, { interface: 'input' }],
    ['max_uses', { name: 'max_uses', type: 'integer', schema: { is_nullable: true } }, { interface: 'input' }],
    ['used_count', { name: 'used_count', type: 'integer', schema: { default_value: 0 } }, { interface: 'input' }],
    ['expires_at', { name: 'expires_at', type: 'dateTime', schema: { is_nullable: true } }, { interface: 'datetime' }],
    ['stripe_coupon_id', { name: 'stripe_coupon_id', type: 'string' }, { interface: 'input' }],
    ['is_active', { name: 'is_active', type: 'boolean', schema: { default_value: true } }, { interface: 'boolean' }],
    ['description', { name: 'description', type: 'string', schema: { is_nullable: true } }, { interface: 'input' }],
  ]) {
    await safeCreate(() => client.request(createField('coupons', { field, ...schema, meta })),
      `field: coupons.${field}`);
  }

  // gift_cards
  await safeCreate(() => client.request(createCollection({
    collection: 'gift_cards',
    meta: { icon: 'card_giftcard', display_template: '{{code}} — {{remaining_value}}€' },
    schema: { name: 'gift_cards' },
  })), 'collection: gift_cards');

  for (const [field, schema, meta] of [
    ['code', { name: 'code', type: 'string', schema: { is_unique: true } }, { interface: 'input' }],
    ['initial_value', { name: 'initial_value', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['remaining_value', { name: 'remaining_value', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['expires_at', { name: 'expires_at', type: 'dateTime', schema: { is_nullable: true } }, { interface: 'datetime' }],
    ['is_active', { name: 'is_active', type: 'boolean', schema: { default_value: true } }, { interface: 'boolean' }],
    ['redemptions', { name: 'redemptions', type: 'json', schema: { default_value: '[]' } }, { interface: 'input-code', options: { language: 'json' } }],
  ]) {
    await safeCreate(() => client.request(createField('gift_cards', { field, ...schema, meta })),
      `field: gift_cards.${field}`);
  }

  // shipping_zones
  await safeCreate(() => client.request(createCollection({
    collection: 'shipping_zones',
    meta: { icon: 'local_shipping', display_template: '{{name}}' },
    schema: { name: 'shipping_zones' },
  })), 'collection: shipping_zones');

  for (const [field, schema, meta] of [
    ['name', { name: 'name', type: 'string' }, { interface: 'input' }],
    ['countries', { name: 'countries', type: 'json' }, { interface: 'input-code', options: { language: 'json' } }],
    ['base_rate', { name: 'base_rate', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 } }, { interface: 'input' }],
    ['free_shipping_threshold', { name: 'free_shipping_threshold', type: 'decimal', schema: { is_nullable: true } }, { interface: 'input' }],
    ['rate_per_kg', { name: 'rate_per_kg', type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2, default_value: 0 } }, { interface: 'input' }],
    ['max_weight_g', { name: 'max_weight_g', type: 'integer', schema: { is_nullable: true } }, { interface: 'input' }],
    ['is_active', { name: 'is_active', type: 'boolean', schema: { default_value: true } }, { interface: 'boolean' }],
  ]) {
    await safeCreate(() => client.request(createField('shipping_zones', { field, ...schema, meta })),
      `field: shipping_zones.${field}`);
  }

  // customers
  await safeCreate(() => client.request(createCollection({
    collection: 'customers',
    meta: { icon: 'person', display_template: '{{first_name}} {{last_name}}' },
    schema: { name: 'customers' },
  })), 'collection: customers');

  for (const [field, schema, meta] of [
    ['first_name', { name: 'first_name', type: 'string' }, { interface: 'input' }],
    ['last_name', { name: 'last_name', type: 'string' }, { interface: 'input' }],
    ['phone', { name: 'phone', type: 'string', schema: { is_nullable: true } }, { interface: 'input' }],
    ['default_shipping_address', { name: 'default_shipping_address', type: 'json', schema: { is_nullable: true } }, { interface: 'input-code', options: { language: 'json' } }],
    ['stripe_customer_id', { name: 'stripe_customer_id', type: 'string', schema: { is_nullable: true } }, { interface: 'input' }],
    ['total_orders', { name: 'total_orders', type: 'integer', schema: { default_value: 0 } }, { interface: 'input' }],
    ['total_spent', { name: 'total_spent', type: 'decimal', schema: { numeric_precision: 12, numeric_scale: 2, default_value: 0 } }, { interface: 'input' }],
  ]) {
    await safeCreate(() => client.request(createField('customers', { field, ...schema, meta })),
      `field: customers.${field}`);
  }

  console.log('\n✓ Setup completato.');
  console.log('\nPassaggi manuali rimanenti:');
  console.log('  1. Crea campo "images" (M2M files) su products dall\'admin Directus');
  console.log('  2. Crea campo "digital_file" (M2O file) su product_variants');
  console.log('  3. Crea relazioni FK (product_variants.product_id, order_items.order_id, ecc.)');
  console.log('  4. Imposta permessi ruolo Public: Read su products, product_variants, product_categories, pages, posts, faq, site_settings');
  console.log('  5. Abilita Read su directus_files per ruolo Public');
}

main().catch(console.error);
```

- [ ] **Step 4.2: Esegui lo script (con DDEV attivo)**

```bash
cd ~/Sites/directus-cms && ddev start
cd -
DIRECTUS_TOKEN=$(grep DIRECTUS_TOKEN .env | cut -d= -f2) node scripts/setup-collections.mjs
```

Expected: `✓ Setup completato.` con lista passaggi manuali.

- [ ] **Step 4.3: Commit**

```bash
git add scripts/setup-collections.mjs
git commit -m "feat: add Directus collections setup script"
```

---

## Task 5: Stili e Animazioni

**Files:**
- Create: `src/styles/theme.css`
- Create: `src/styles/global.css`
- Create: `src/animations/gsap.ts`
- Create: `src/animations/presets.ts`

- [ ] **Step 5.1: Crea `src/styles/theme.css`** (identico al template base)

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
  --color-accent: #f59e0b;
  --color-bg: #ffffff;
  --color-surface: #f9fafb;
  --color-text: #111827;
  --color-muted: #6b7280;
  --color-success: #16a34a;
  --color-error: #dc2626;

  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;

  --radius: 0.5rem;
  --max-width: 1200px;
}

:root {
  --animation-style: elegant;
}
```

- [ ] **Step 5.2: Copia `src/styles/global.css` e `src/animations/`** dal template base o ricrea identici.

- [ ] **Step 5.3: Commit**

```bash
git add src/styles/ src/animations/
git commit -m "feat: add theme, global styles and GSAP animations"
```

---

## Task 6: Layout Base

**Files:**
- Create: `src/layouts/Base.astro`
- Create: `src/layouts/Page.astro`
- Create: `src/components/layout/Header.astro`
- Create: `src/components/layout/Footer.astro`
- Create: `src/components/layout/Nav.astro`
- Create: `src/components/ui/Button.astro`
- Create: `src/components/ui/Badge.astro`

- [ ] **Step 6.1: Crea `src/layouts/Base.astro`**

```astro
---
import '../styles/global.css';
import Header from '../components/layout/Header.astro';
import Footer from '../components/layout/Footer.astro';
import { getSiteSettings } from '../lib/directus';

interface Props {
  title: string;
  description?: string;
  lang?: string;
}

const { title, description = '', lang = 'it' } = Astro.props;
const settings = await getSiteSettings();
---
<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}{settings?.site_name ? ` | ${settings.site_name}` : ''}</title>
    {description && <meta name="description" content={description} />}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <Header settings={settings} lang={lang} />
    <main>
      <slot />
    </main>
    <Footer settings={settings} />
    <script>
      import '../animations/gsap';
    </script>
  </body>
</html>
```

- [ ] **Step 6.2: Crea `src/components/layout/Header.astro`**

```astro
---
import type { SiteSettings } from '../../lib/types';

interface Props {
  settings: SiteSettings | null;
  lang: string;
}
const { settings, lang } = Astro.props;
const shopPath = lang === 'it' ? '/negozio' : '/en/shop';
const blogPath = lang === 'it' ? '/blog' : '/en/blog';
---
<header class="sticky top-0 z-50 bg-[var(--color-bg)] border-b border-gray-100">
  <nav class="max-w-[var(--max-width)] mx-auto px-4 h-16 flex items-center justify-between">
    <a href={lang === 'it' ? '/' : '/en'} class="font-bold text-lg">
      {settings?.site_name ?? 'Shop'}
    </a>
    <div class="flex gap-6 items-center">
      <a href={shopPath}>Negozio</a>
      <a href={blogPath}>Blog</a>
      <a href="/carrello" aria-label="Carrello">
        <span id="cart-count" class="hidden">0</span>
        🛒
      </a>
      <a href="/account">Account</a>
    </div>
  </nav>
</header>
```

- [ ] **Step 6.3: Commit**

```bash
git add src/layouts/ src/components/layout/ src/components/ui/
git commit -m "feat: add base layouts and layout components"
```

---

## Task 7: Pagine Catalogo Prodotti (SSG)

**Files:**
- Create: `src/pages/negozio/index.astro`
- Create: `src/pages/negozio/[categoria].astro`
- Create: `src/pages/negozio/[slug].astro`
- Create: `src/components/shop/ProductGrid.astro`
- Create: `src/components/shop/ProductCard.astro`

- [ ] **Step 7.1: Crea `src/components/shop/ProductCard.astro`**

```astro
---
import type { Product } from '../../lib/types';
import { assetUrl } from '../../lib/directus';
import Badge from '../ui/Badge.astro';

interface Props {
  product: Product;
}

const { product } = Astro.props;
const firstImage = product.images?.[0]?.directus_files_id ?? null;
const imageUrl = assetUrl(firstImage);
const price = product.variants?.[0]?.price_override ?? product.base_price;
const isOutOfStock = product.variants?.every(v => v.stock_quantity === 0) ?? false;
---
<article class="group relative rounded-[var(--radius)] overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
  <a href={`/negozio/${product.slug}`} class="block">
    <div class="aspect-square bg-gray-50 overflow-hidden">
      {imageUrl
        ? <img src={imageUrl} alt={product.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        : <div class="w-full h-full flex items-center justify-center text-gray-300">No image</div>
      }
    </div>
    <div class="p-4">
      <h3 class="font-medium text-[var(--color-text)] truncate">{product.name}</h3>
      <div class="flex items-center gap-2 mt-1">
        <span class="font-bold text-[var(--color-brand)]">€{price.toFixed(2)}</span>
        {product.compare_price && (
          <span class="text-sm text-[var(--color-muted)] line-through">€{product.compare_price.toFixed(2)}</span>
        )}
      </div>
      {isOutOfStock && <Badge variant="error" class="mt-2">Esaurito</Badge>}
      {product.type === 'digital' && <Badge variant="info" class="mt-2">Digitale</Badge>}
    </div>
  </a>
</article>
```

- [ ] **Step 7.2: Crea `src/components/shop/ProductGrid.astro`**

```astro
---
import type { Product } from '../../lib/types';
import ProductCard from './ProductCard.astro';

interface Props {
  products: Product[];
  title?: string;
}

const { products, title } = Astro.props;
---
<section>
  {title && <h2 class="text-2xl font-bold mb-6">{title}</h2>}
  {products.length === 0
    ? <p class="text-[var(--color-muted)]">Nessun prodotto trovato.</p>
    : (
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map(p => <ProductCard product={p} />)}
      </div>
    )
  }
</section>
```

- [ ] **Step 7.3: Crea `src/pages/negozio/index.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import ProductGrid from '../../components/shop/ProductGrid.astro';
import { getProducts, getProductCategories } from '../../lib/directus';

const products = await getProducts();
const categories = await getProductCategories();
---
<Base title="Negozio">
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <h1 class="text-4xl font-bold mb-8">Negozio</h1>

    {categories.length > 0 && (
      <div class="flex gap-3 mb-8 flex-wrap">
        <a href="/negozio" class="px-4 py-2 rounded-full bg-[var(--color-brand)] text-white text-sm">Tutti</a>
        {categories.map(cat => (
          <a href={`/negozio/${cat.slug}`} class="px-4 py-2 rounded-full border border-gray-200 text-sm hover:border-[var(--color-brand)]">
            {cat.name}
          </a>
        ))}
      </div>
    )}

    <ProductGrid products={products} />
  </div>
</Base>
```

- [ ] **Step 7.4: Crea `src/pages/negozio/[categoria].astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import ProductGrid from '../../components/shop/ProductGrid.astro';
import { getProducts, getProductCategories, getProductCategory } from '../../lib/directus';

export async function getStaticPaths() {
  const categories = await getProductCategories();
  return categories.map(cat => ({ params: { categoria: cat.slug } }));
}

const { categoria } = Astro.params;
const category = await getProductCategory(categoria!);
const allProducts = await getProducts();
const products = allProducts.filter(p => p.category_id?.slug === categoria);
---
<Base title={category?.name ?? 'Categoria'}>
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <div class="mb-8">
      <a href="/negozio" class="text-[var(--color-muted)] text-sm hover:text-[var(--color-brand)]">← Tutti i prodotti</a>
      <h1 class="text-4xl font-bold mt-2">{category?.name}</h1>
      {category?.description && <p class="text-[var(--color-muted)] mt-2">{category.description}</p>}
    </div>
    <ProductGrid products={products} />
  </div>
</Base>
```

- [ ] **Step 7.5: Crea `src/pages/negozio/[slug].astro`** (PDP)

```astro
---
import Base from '../../layouts/Base.astro';
import { getProduct, getProductSlugs, assetUrl } from '../../lib/directus';
import Badge from '../../components/ui/Badge.astro';

export async function getStaticPaths() {
  const slugs = await getProductSlugs();
  return slugs.map(({ slug }) => ({ params: { slug } }));
}

const { slug } = Astro.params;
const product = await getProduct(slug!);

if (!product) return Astro.redirect('/negozio');

const images = product.images?.map(i => assetUrl(i.directus_files_id)).filter(Boolean) ?? [];
const activeVariants = product.variants?.filter(v => v.is_active) ?? [];
---
<Base title={product.seo_title ?? product.name} description={product.seo_description ?? undefined}>
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <a href="/negozio" class="text-[var(--color-muted)] text-sm hover:text-[var(--color-brand)]">← Torna al negozio</a>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-6">
      <!-- Gallery -->
      <div class="space-y-4">
        {images[0]
          ? <img src={images[0]} alt={product.name} class="w-full aspect-square object-cover rounded-[var(--radius)]" />
          : <div class="w-full aspect-square bg-gray-100 rounded-[var(--radius)]" />
        }
        {images.length > 1 && (
          <div class="grid grid-cols-4 gap-2">
            {images.slice(1).map(url => (
              <img src={url!} alt={product.name} class="aspect-square object-cover rounded cursor-pointer opacity-70 hover:opacity-100" />
            ))}
          </div>
        )}
      </div>

      <!-- Info -->
      <div>
        {product.category_id && (
          <a href={`/negozio/${product.category_id.slug}`} class="text-sm text-[var(--color-brand)]">
            {product.category_id.name}
          </a>
        )}
        <h1 class="text-3xl font-bold mt-2 mb-4">{product.name}</h1>

        <div class="flex items-center gap-3 mb-6">
          <span class="text-2xl font-bold text-[var(--color-brand)]">
            €{(activeVariants[0]?.price_override ?? product.base_price).toFixed(2)}
          </span>
          {product.compare_price && (
            <span class="text-lg text-[var(--color-muted)] line-through">€{product.compare_price.toFixed(2)}</span>
          )}
          {product.type === 'digital' && <Badge variant="info">Download digitale</Badge>}
        </div>

        {product.description && (
          <div class="prose text-[var(--color-muted)] mb-8" set:html={product.description} />
        )}

        <!-- Variant selector + Add to cart (Piano 2) -->
        <div id="add-to-cart-placeholder" data-product={JSON.stringify({
          id: product.id,
          name: product.name,
          type: product.type,
          basePrice: product.base_price,
          weightG: product.weight_g,
          variants: activeVariants,
        })}>
          <p class="text-sm text-[var(--color-muted)]">Carrello disponibile nel Piano 2.</p>
        </div>
      </div>
    </div>
  </div>
</Base>
```

- [ ] **Step 7.6: Crea `src/components/ui/Badge.astro`**

```astro
---
interface Props {
  variant?: 'default' | 'info' | 'success' | 'error';
  class?: string;
}
const { variant = 'default', class: className = '' } = Astro.props;
const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};
---
<span class={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${variantClasses[variant]} ${className}`}>
  <slot />
</span>
```

- [ ] **Step 7.7: Esegui build**

```bash
npm run build
```

Expected: build completata senza errori TypeScript. Verifica `dist/` contiene file HTML per negozio.

- [ ] **Step 7.8: Commit**

```bash
git add src/pages/negozio/ src/components/shop/ src/components/ui/Badge.astro
git commit -m "feat: add product catalog pages (SSG) - shop index, category, PDP"
```

---

## Task 8: Homepage e Pagine CMS

**Files:**
- Create: `src/pages/index.astro`
- Create: `src/pages/[slug].astro`
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[slug].astro`

- [ ] **Step 8.1: Crea `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import ProductGrid from '../components/shop/ProductGrid.astro';
import { getProducts } from '../lib/directus';

const featured = await getProducts({ featured: true });
---
<Base title="Home">
  <section class="max-w-[var(--max-width)] mx-auto px-4 py-20 text-center">
    <h1 class="text-5xl font-bold mb-4">Benvenuto nel negozio</h1>
    <p class="text-[var(--color-muted)] text-xl mb-8">Scopri i nostri prodotti</p>
    <a href="/negozio" class="inline-block px-8 py-3 bg-[var(--color-brand)] text-white rounded-[var(--radius)] font-medium hover:opacity-90">
      Vai al negozio
    </a>
  </section>

  {featured.length > 0 && (
    <section class="max-w-[var(--max-width)] mx-auto px-4 py-12">
      <ProductGrid products={featured} title="Prodotti in evidenza" />
    </section>
  )}
</Base>
```

- [ ] **Step 8.2: Crea `src/pages/[slug].astro`** (pagine CMS dinamiche)

```astro
---
import Base from '../layouts/Base.astro';
import { getPage } from '../lib/directus';

export async function getStaticPaths() {
  // Pagine statiche gestite da Directus — aggiunge slug dinamicamente
  // Esegui il build dopo aver aggiunto pagine in Directus
  return [];
}

const { slug } = Astro.params;
const page = await getPage(slug!);

if (!page) return Astro.redirect('/');
---
<Base title={page.seo_title ?? page.title} description={page.seo_description ?? undefined}>
  <article class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <h1 class="text-4xl font-bold mb-8">{page.title}</h1>
    <div class="prose max-w-none" set:html={JSON.stringify(page.blocks)} />
  </article>
</Base>
```

- [ ] **Step 8.3: Crea pagine blog** (identiche al template base — `/blog/index.astro` e `/blog/[slug].astro`)

- [ ] **Step 8.4: Esegui dev server e verifica**

```bash
npm run dev
```

Apri `http://localhost:4321` — verifica: homepage, `/negozio`, `/negozio/[categoria]`, `/negozio/[slug]` funzionanti. Nessun errore console.

- [ ] **Step 8.5: Commit**

```bash
git add src/pages/
git commit -m "feat: add homepage, CMS pages and blog"
```

---

## Checklist Finale Piano 1

- [ ] `npm run build` — 0 errori
- [ ] `npx astro check` — 0 errori TypeScript
- [ ] `npm test` — tutti i test passano
- [ ] Dev server mostra homepage e catalogo prodotti
- [ ] Script setup collezioni eseguito su Directus locale
- [ ] Commit finale con tag `v0.1.0-catalog`

```bash
git tag v0.1.0-catalog
```

---

**Prossimo piano:** [Piano 2 — Cart & Checkout](2026-05-03-ecommerce-plan-2-cart-checkout.md)
