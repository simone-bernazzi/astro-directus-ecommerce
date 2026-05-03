# E-commerce Template — Piano 5: i18n & Security

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere il multilingua (IT/EN) tramite Astro i18n nativo + Directus Translations, e completare la configurazione sicurezza (CSP headers, permessi Directus, rate limiting).

**Architecture:** Astro i18n con `prefixDefaultLocale: false` — italiano senza prefisso, inglese con `/en/`. Le collezioni Directus hanno sub-collezioni `_translations` per i campi di testo. Helper `t()` per filtrare le traduzioni nel componente. I security headers sono già parzialmente in `netlify.toml` — questo piano li completa e aggiunge rate limiting via Netlify Edge Functions.

**Tech Stack:** Astro i18n (built-in), Directus Translations interface, Netlify Edge Functions.

**Prerequisito:** Piano 4 completato.

---

## Struttura File (questo piano)

```
src/
├── lib/
│   └── i18n.ts                        # Helper per traduzioni + routing
├── pages/
│   └── en/
│       ├── index.astro                # Homepage EN
│       ├── shop/
│       │   ├── index.astro            # Shop EN
│       │   └── [slug].astro           # PDP EN
│       └── blog/
│           ├── index.astro
│           └── [slug].astro
netlify/
└── edge-functions/
    └── rate-limit.ts                  # Rate limiting su /api/*
netlify.toml                           # Aggiornato con edge function
```

---

## Task 1: i18n Helper

**Files:**
- Create: `src/lib/i18n.ts`
- Create: `src/lib/i18n.test.ts`

- [ ] **Step 1.1: Crea `src/lib/i18n.ts`**

```typescript
import type { Translation } from './types';

export type Locale = 'it' | 'en';
export const DEFAULT_LOCALE: Locale = 'it';
export const LOCALES: Locale[] = ['it', 'en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
};

export const SHOP_PATHS: Record<Locale, string> = {
  it: '/negozio',
  en: '/en/shop',
};

export const BLOG_PATHS: Record<Locale, string> = {
  it: '/blog',
  en: '/en/blog',
};

/** Estrae i campi tradotti per la lingua richiesta, con fallback alla lingua di default */
export function getTranslation<T extends Record<string, unknown>>(
  translations: Translation[] | undefined,
  locale: Locale,
  fallback?: Partial<T>
): Partial<T> {
  if (!translations || translations.length === 0) return fallback ?? {};

  const match = translations.find(t => t.languages_code === locale);
  if (match) return match as Partial<T>;

  const defaultMatch = translations.find(t => t.languages_code === DEFAULT_LOCALE);
  return (defaultMatch as Partial<T>) ?? fallback ?? {};
}

/** Helper per costruire URL localizzati */
export function localePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  return `/en${path}`;
}

/** Rileva la locale dall'URL Astro */
export function getLocaleFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'en') return 'en';
  return DEFAULT_LOCALE;
}
```

- [ ] **Step 1.2: Crea `src/lib/i18n.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { getTranslation, localePath, getLocaleFromUrl } from './i18n';
import type { Translation } from './types';

const translations: Translation[] = [
  { languages_code: 'it', name: 'Ciao', description: 'Descrizione italiana' },
  { languages_code: 'en', name: 'Hello', description: 'English description' },
];

describe('getTranslation', () => {
  it('returns translation for requested locale', () => {
    const t = getTranslation(translations, 'en');
    expect(t.name).toBe('Hello');
  });

  it('falls back to default locale when requested locale missing', () => {
    const onlyIt: Translation[] = [{ languages_code: 'it', name: 'Ciao' }];
    const t = getTranslation(onlyIt, 'en');
    expect(t.name).toBe('Ciao');
  });

  it('returns fallback when no translations', () => {
    const t = getTranslation(undefined, 'en', { name: 'Default' });
    expect(t.name).toBe('Default');
  });
});

describe('localePath', () => {
  it('returns path unchanged for default locale', () => {
    expect(localePath('/negozio', 'it')).toBe('/negozio');
  });

  it('prepends /en for non-default locale', () => {
    expect(localePath('/shop', 'en')).toBe('/en/shop');
  });
});

describe('getLocaleFromUrl', () => {
  it('detects italian from root path', () => {
    expect(getLocaleFromUrl(new URL('http://example.com/negozio'))).toBe('it');
  });

  it('detects english from /en prefix', () => {
    expect(getLocaleFromUrl(new URL('http://example.com/en/shop'))).toBe('en');
  });
});
```

- [ ] **Step 1.3: Esegui test**

```bash
npm test
```

Expected: PASS (6 nuovi test).

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/i18n.ts src/lib/i18n.test.ts
git commit -m "feat: add i18n helpers for locale detection and translations"
```

---

## Task 2: Pagine EN (Shop + Blog)

- [ ] **Step 2.1: Crea `src/pages/en/index.astro`**

```astro
---
import Base from '../../layouts/Base.astro';
import ProductGrid from '../../components/shop/ProductGrid.astro';
import { getProducts } from '../../lib/directus';
import { getTranslation } from '../../lib/i18n';

const featured = await getProducts({ featured: true });
---
<Base title="Home" lang="en">
  <section class="max-w-[var(--max-width)] mx-auto px-4 py-20 text-center">
    <h1 class="text-5xl font-bold mb-4">Welcome to the shop</h1>
    <p class="text-[var(--color-muted)] text-xl mb-8">Discover our products</p>
    <a href="/en/shop" class="inline-block px-8 py-3 bg-[var(--color-brand)] text-white rounded-[var(--radius)] font-medium hover:opacity-90">
      Go to shop
    </a>
  </section>

  {featured.length > 0 && (
    <section class="max-w-[var(--max-width)] mx-auto px-4 py-12">
      <ProductGrid products={featured} title="Featured products" />
    </section>
  )}
</Base>
```

- [ ] **Step 2.2: Crea `src/pages/en/shop/index.astro`**

```astro
---
import Base from '../../../layouts/Base.astro';
import ProductGrid from '../../../components/shop/ProductGrid.astro';
import { getProducts, getProductCategories } from '../../../lib/directus';
import { getTranslation } from '../../../lib/i18n';

const products = await getProducts();
const categories = await getProductCategories();

// Usa traduzione EN per nome categoria
const categoriesEN = categories.map(c => ({
  ...c,
  name: getTranslation(c.translations, 'en').name as string ?? c.name,
}));
---
<Base title="Shop" lang="en">
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <h1 class="text-4xl font-bold mb-8">Shop</h1>

    {categoriesEN.length > 0 && (
      <div class="flex gap-3 mb-8 flex-wrap">
        <a href="/en/shop" class="px-4 py-2 rounded-full bg-[var(--color-brand)] text-white text-sm">All</a>
        {categoriesEN.map(cat => (
          <a href={`/en/shop/category/${cat.slug}`} class="px-4 py-2 rounded-full border border-gray-200 text-sm hover:border-[var(--color-brand)]">
            {cat.name}
          </a>
        ))}
      </div>
    )}

    <ProductGrid products={products} />
  </div>
</Base>
```

- [ ] **Step 2.3: Crea `src/pages/en/shop/[slug].astro`** (PDP EN)

```astro
---
import Base from '../../../layouts/Base.astro';
import { getProduct, getProductSlugs, assetUrl } from '../../../lib/directus';
import { getTranslation } from '../../../lib/i18n';
import VariantSelector from '../../../components/shop/VariantSelector.astro';
import AddToCart from '../../../components/shop/AddToCart.astro';
import Badge from '../../../components/ui/Badge.astro';

export async function getStaticPaths() {
  const slugs = await getProductSlugs();
  return slugs.map(({ slug }) => ({ params: { slug } }));
}

const { slug } = Astro.params;
const product = await getProduct(slug!);
if (!product) return Astro.redirect('/en/shop');

const t = getTranslation(product.translations, 'en');
const name = (t.name as string) ?? product.name;
const description = (t.description as string) ?? product.description;

const images = product.images?.map(i => assetUrl(i.directus_files_id)).filter(Boolean) ?? [];
const activeVariants = product.variants?.filter(v => v.is_active) ?? [];
---
<Base title={(t.seo_title as string) ?? name} description={(t.seo_description as string) ?? undefined} lang="en">
  <div class="max-w-[var(--max-width)] mx-auto px-4 py-12">
    <a href="/en/shop" class="text-[var(--color-muted)] text-sm hover:text-[var(--color-brand)]">← Back to shop</a>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-6">
      <div class="space-y-4">
        {images[0]
          ? <img src={images[0]} alt={name} class="w-full aspect-square object-cover rounded-[var(--radius)]" />
          : <div class="w-full aspect-square bg-gray-100 rounded-[var(--radius)]" />
        }
      </div>
      <div>
        <h1 class="text-3xl font-bold mt-2 mb-4">{name}</h1>
        <div class="flex items-center gap-3 mb-6">
          <span class="text-2xl font-bold text-[var(--color-brand)]">
            €{(activeVariants[0]?.price_override ?? product.base_price).toFixed(2)}
          </span>
          {product.type === 'digital' && <Badge variant="info">Digital download</Badge>}
        </div>
        {description && <div class="prose text-[var(--color-muted)] mb-8" set:html={description} />}
        <VariantSelector variants={activeVariants} basePrice={product.base_price} />
        <AddToCart
          productId={product.id}
          productName={name}
          productType={product.type}
          weightG={product.weight_g}
          image={images[0] ?? null}
        />
      </div>
    </div>
  </div>
</Base>
```

- [ ] **Step 2.4: Aggiorna `src/components/layout/Header.astro`** — aggiungi LanguageSwitcher

```astro
---
import type { SiteSettings } from '../../lib/types';
import { getLocaleFromUrl, SHOP_PATHS, BLOG_PATHS } from '../../lib/i18n';

interface Props {
  settings: SiteSettings | null;
  lang?: string;
}
const { settings, lang = 'it' } = Astro.props;
const locale = lang === 'en' ? 'en' : 'it';
const shopPath = SHOP_PATHS[locale];
const blogPath = BLOG_PATHS[locale];
const altLocale = locale === 'it' ? 'en' : 'it';
const altLabel = locale === 'it' ? 'EN' : 'IT';
const altHref = locale === 'it' ? '/en' : '/';
---
<header class="sticky top-0 z-50 bg-[var(--color-bg)] border-b border-gray-100">
  <nav class="max-w-[var(--max-width)] mx-auto px-4 h-16 flex items-center justify-between">
    <a href={locale === 'it' ? '/' : '/en'} class="font-bold text-lg">
      {settings?.site_name ?? 'Shop'}
    </a>
    <div class="flex gap-6 items-center">
      <a href={shopPath}>{locale === 'it' ? 'Negozio' : 'Shop'}</a>
      <a href={blogPath}>Blog</a>
      <a href="/gift-card">Gift Card</a>
      <a href="/carrello" aria-label="Carrello">🛒</a>
      <a href={locale === 'it' ? '/account' : '/en/account'}>Account</a>
      <a href={altHref} class="text-xs border rounded px-2 py-1 hover:border-[var(--color-brand)]">{altLabel}</a>
    </div>
  </nav>
</header>
```

- [ ] **Step 2.5: Commit**

```bash
git add src/pages/en/ src/components/layout/Header.astro
git commit -m "feat: add English pages and language switcher"
```

---

## Task 3: Directus Translations Setup

- [ ] **Step 3.1: Crea le sub-collezioni translations in Directus Admin**

Per ogni collezione traducibile, aggiungere il campo "Translations" dall'interfaccia Directus:

**products:**
1. Admin → Collections → products → Add field → "Translations"
2. Nome: `translations`
3. Lingue: IT, EN
4. Campi traducibili: `name`, `description`, `seo_title`, `seo_description`

**product_categories:**
1. Add field → "Translations"
2. Campi traducibili: `name`, `description`, `seo_title`, `seo_description`

**pages:**
1. Add field → "Translations"
2. Campi traducibili: `title`, `blocks`, `seo_title`, `seo_description`

**posts:**
1. Add field → "Translations"
2. Campi traducibili: `title`, `content`, `seo_title`, `seo_description`

**site_settings:**
1. Add field → "Translations"
2. Campi traducibili: `nav_links`, `footer_text`

**faq:**
1. Add field → "Translations"
2. Campi traducibili: `question`, `answer`

- [ ] **Step 3.2: Aggiungi lingue in Directus Admin**

Settings → Translations → Languages → Add:
- Code: `it`, Name: Italiano
- Code: `en`, Name: English

- [ ] **Step 3.3: Commit**

```bash
git commit -m "docs: add Directus translations setup instructions in plan" --allow-empty
```

---

## Task 4: Security — Rate Limiting via Netlify Edge Function

- [ ] **Step 4.1: Crea `netlify/edge-functions/rate-limit.ts`**

```typescript
import type { Config, Context } from '@netlify/edge-functions';

const WINDOW_MS = 60_000; // 1 minuto
const MAX_REQUESTS = 20;

const store = new Map<string, { count: number; resetAt: number }>();

export default async function handler(request: Request, context: Context) {
  const ip = context.ip ?? 'unknown';
  const now = Date.now();

  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return context.next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
      },
    });
  }

  return context.next();
}

export const config: Config = {
  path: '/api/*',
};
```

- [ ] **Step 4.2: Aggiorna `netlify.toml`** — aggiungi edge function**

```toml
[[edge_functions]]
  path = "/api/*"
  function = "rate-limit"
```

- [ ] **Step 4.3: Commit**

```bash
git add netlify/edge-functions/ netlify.toml
git commit -m "feat: add rate limiting edge function for /api/* endpoints"
```

---

## Task 5: Security Headers Completi

- [ ] **Step 5.1: Aggiorna `netlify.toml`** — headers completi e HSTS

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' js.stripe.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; frame-src js.stripe.com; connect-src 'self' api.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=(self)"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```

**Nota:** `'unsafe-inline'` per script/style è necessario per Astro islands e GSAP. In produzione valutare nonce-based CSP per eliminarlo.

- [ ] **Step 5.2: Esegui build e verifica headers**

```bash
npm run build
netlify dev
```

In un'altra finestra: `curl -I http://localhost:8888/` — verifica presenza di `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`.

- [ ] **Step 5.3: Commit**

```bash
git add netlify.toml
git commit -m "feat: complete security headers with HSTS and strict CSP"
```

---

## Task 6: Verifica Permessi Directus

- [ ] **Step 6.1: Configura ruolo Public in Directus Admin**

Admin → Settings → Roles → Public → Permissions:

| Collezione | Read | Create | Update | Delete |
|---|---|---|---|---|
| products | ✓ (filter: is_active=true) | — | — | — |
| product_variants | ✓ (filter: is_active=true) | — | — | — |
| product_categories | ✓ | — | — | — |
| pages | ✓ | — | — | — |
| posts | ✓ (filter: status=published) | — | — | — |
| faq | ✓ | — | — | — |
| site_settings | ✓ | — | — | — |
| directus_files | ✓ | — | — | — |
| orders | — | — | — | — |
| customers | — | — | — | — |
| gift_cards | — | — | — | — |
| coupons | — | — | — | — |

- [ ] **Step 6.2: Configura ruolo Customer**

Admin → Settings → Roles → Create → "Customer":
- Permissions su `orders`: Read (filter: customer_id = $CURRENT_USER.customer.id)
- Permissions su `customers`: Read + Update (filter: directus_user_id = $CURRENT_USER)
- Permissions su `order_items`: Read (via orders relation)

- [ ] **Step 6.3: Commit**

```bash
git commit -m "docs: add Directus permissions configuration in plan" --allow-empty
```

---

## Checklist Finale Piano 5

- [ ] `npm test` — tutti i test passano (inclusi i18n tests)
- [ ] `npm run build` — 0 errori
- [ ] `/en/shop` mostra prodotti con nomi in inglese (da Directus translations)
- [ ] Language switcher in header funziona
- [ ] `curl -I https://sito.netlify.app/` mostra tutti gli header di sicurezza
- [ ] Rate limiter: 21 richieste rapide a `/api/checkout` → 429 alla 21esima
- [ ] Ruolo Public Directus: API `/items/orders` senza token → 403
- [ ] Commit finale con tag `v1.0.0`

```bash
git tag v1.0.0
git push && git push --tags
```

---

## Riepilogo Piani Completati

| Piano | Tag | Features |
|---|---|---|
| 1 — Foundation | `v0.1.0-catalog` | Setup, types, Directus collections, catalogo SSG |
| 2 — Cart & Checkout | `v0.2.0-checkout` | Carrello, Stripe Checkout, validazione server-side |
| 3 — Post-Purchase | `v0.3.0-post-purchase` | Webhook, ordini, download digitali, account SSR |
| 4 — Commerce Features | `v0.4.0-commerce` | Gift card vendita, registrazione account |
| 5 — i18n & Security | `v1.0.0` | Multilingua IT/EN, rate limiting, CSP, permessi |

**Deploy su Netlify:**
1. New site → Import da GitHub → `astro-directus-ecommerce`
2. Build: `npm run build` · Publish: `dist` · Node: 22
3. Env vars: tutte le variabili di `.env.example`
4. Stripe webhook: `https://tuosito.netlify.app/api/webhook/stripe`
5. Directus Flow: webhook rebuild Netlify on publish
