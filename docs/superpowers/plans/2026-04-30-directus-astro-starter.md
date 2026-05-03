# Directus + Astro Starter Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire un template starter Astro riutilizzabile collegato a Directus CMS, deployabile su Netlify, con sistema di temi via CSS custom properties e animazioni GSAP a 4 preset.

**Architecture:** Astro genera HTML statico a build time fetchando i contenuti da Directus via REST API. Tailwind v4 usa CSS custom properties (`@theme`) per la personalizzazione per-cliente. GSAP + Lenis gestiscono le animazioni con 4 preset selezionabili. Netlify builda su git push o webhook Directus.

**Tech Stack:** Astro 6 · TypeScript · Tailwind CSS v4 (`@tailwindcss/vite`) · GSAP 3 · Lenis · `@directus/sdk` v21 · Netlify

**Status:** ✅ Completato — 2026-05-02  
**Repo:** git@github.com:simone-bernazzi/astro-directus-starter.git (branch: main)  
**Pendente (manuale):** Task 4 (collezioni Directus), setup Netlify, build hook, custom domain

---

## File Map

| File | Responsabilità |
|---|---|
| `src/lib/directus.ts` | SDK client + typed query helpers |
| `src/lib/types.ts` | TypeScript interfaces per tutte le collezioni |
| `src/styles/theme.css` | CSS custom properties per tema cliente |
| `src/styles/global.css` | Reset, utility globali, import Tailwind |
| `src/animations/gsap.ts` | Setup GSAP + ScrollTrigger + Lenis |
| `src/animations/presets.ts` | Funzioni animazione: fadeUp, staggerIn, splitTitle, parallax |
| `src/layouts/Base.astro` | HTML shell, meta, font, import stili globali |
| `src/layouts/Page.astro` | Layout per pagine statiche e landing |
| `src/layouts/Post.astro` | Layout per articoli blog |
| `src/components/layout/Header.astro` | Header con logo e nav |
| `src/components/layout/Nav.astro` | Navigazione desktop + mobile |
| `src/components/layout/Footer.astro` | Footer con link e social |
| `src/components/ui/Button.astro` | Primitivo bottone |
| `src/components/ui/Card.astro` | Primitivo card |
| `src/components/ui/Badge.astro` | Primitivo badge/tag |
| `src/components/blocks/Hero.astro` | Sezione hero homepage/landing |
| `src/components/blocks/Features.astro` | Griglia feature/servizi |
| `src/components/blocks/CTA.astro` | Call to action |
| `src/components/blocks/Testimonials.astro` | Recensioni/citazioni |
| `src/components/blocks/BlogGrid.astro` | Griglia anteprima post |
| `src/components/blocks/PortfolioGrid.astro` | Griglia portfolio filtrata |
| `src/components/blocks/FaqAccordion.astro` | Accordion FAQ |
| `src/pages/index.astro` | Homepage |
| `src/pages/[slug].astro` | Pagine dinamiche da Directus |
| `src/pages/blog/index.astro` | Lista articoli |
| `src/pages/blog/[slug].astro` | Singolo articolo |
| `src/pages/portfolio/index.astro` | Lista progetti |
| `src/pages/portfolio/[slug].astro` | Singolo progetto |
| `.env.example` | Variabili d'ambiente da copiare |
| `netlify.toml` | Configurazione build Netlify |
| `astro.config.mjs` | Config Astro con plugin Tailwind v4 |

---

## Task 1: Scaffolding del progetto Astro

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, struttura cartelle

- [ ] **Step 1: Crea il progetto Astro**

```bash
npm create astro@latest astro-directus-starter -- --template minimal --typescript strict --no-git --no-install
cd astro-directus-starter
```

- [ ] **Step 2: Installa le dipendenze**

```bash
npm install
npm install @directus/sdk
npm install gsap lenis
npm install -D tailwindcss @tailwindcss/vite
npm install -D vitest
```

- [ ] **Step 3: Crea la struttura delle cartelle**

```bash
mkdir -p src/components/blocks
mkdir -p src/components/layout
mkdir -p src/components/ui
mkdir -p src/layouts
mkdir -p src/lib
mkdir -p src/styles
mkdir -p src/animations
mkdir -p src/pages/blog
mkdir -p src/pages/portfolio
mkdir -p public
```

- [ ] **Step 4: Configura `astro.config.mjs`**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
})
```

- [ ] **Step 5: Configura `tsconfig.json`**

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

- [ ] **Step 6: Aggiungi script vitest in `package.json`**

Apri `package.json` e aggiungi nella sezione `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Verifica che il progetto si avvii**

```bash
npm run dev
```

Atteso: server su `http://localhost:4321` senza errori.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Astro project with Tailwind v4 and dependencies"
```

---

## Task 2: Sistema di temi con Tailwind v4

**Files:**
- Create: `src/styles/theme.css`
- Create: `src/styles/global.css`

- [ ] **Step 1: Crea `src/styles/theme.css`**

Questo è l'unico file da modificare per ogni cliente.

```css
/* src/styles/theme.css */
@theme {
  /* Colori brand */
  --color-brand: #2563eb;
  --color-brand-dark: #1d4ed8;
  --color-accent: #f59e0b;
  --color-bg: #ffffff;
  --color-surface: #f9fafb;
  --color-text: #111827;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;

  /* Tipografia */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Spaziatura */
  --spacing-section: 5rem;
  --max-width-content: 1200px;

  /* Forma */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}

:root {
  /* Stile animazioni attivo: elegant | bold | premium | editorial */
  --animation-style: elegant;
}
```

- [ ] **Step 2: Crea `src/styles/global.css`**

```css
/* src/styles/global.css */
@import "tailwindcss";
@import "./theme.css";

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  line-height: 1.6;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  line-height: 1.2;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

.container {
  width: 100%;
  max-width: var(--max-width-content);
  margin-inline: auto;
  padding-inline: 1.5rem;
}
```

- [ ] **Step 3: Verifica la compilazione Tailwind**

```bash
npm run build
```

Atteso: build completata senza errori CSS.

- [ ] **Step 4: Commit**

```bash
git add src/styles/
git commit -m "feat: add Tailwind v4 theme system with CSS custom properties"
```

---

## Task 3: TypeScript types e Directus client

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/directus.ts`
- Create: `src/lib/directus.test.ts`

- [ ] **Step 1: Crea `src/lib/types.ts`** con le interfacce per tutte le collezioni

```typescript
// src/lib/types.ts

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
  content: string
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
  description: string
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
  type: 'hero' | 'features' | 'cta' | 'testimonials' | 'blog_grid' | 'portfolio_grid' | 'faq'
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
```

- [ ] **Step 2: Scrivi il test fallente per il client Directus**

```typescript
// src/lib/directus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock del modulo @directus/sdk
vi.mock('@directus/sdk', () => ({
  createDirectus: vi.fn(() => ({
    with: vi.fn().mockReturnThis(),
  })),
  rest: vi.fn(),
  readItems: vi.fn((collection) => ({ collection, action: 'readItems' })),
  readItem: vi.fn((collection, id) => ({ collection, id, action: 'readItem' })),
  readSingleton: vi.fn((collection) => ({ collection, action: 'readSingleton' })),
}))

describe('getDirectusImageUrl', () => {
  it('restituisce URL completo dato un file ID', async () => {
    process.env.DIRECTUS_URL = 'https://cms.example.com'
    const { getDirectusImageUrl } = await import('./directus')
    const url = getDirectusImageUrl('abc-123')
    expect(url).toBe('https://cms.example.com/assets/abc-123')
  })

  it('restituisce stringa vuota se fileId è null', async () => {
    const { getDirectusImageUrl } = await import('./directus')
    const url = getDirectusImageUrl(null)
    expect(url).toBe('')
  })

  it('accetta parametri di trasformazione opzionali', async () => {
    process.env.DIRECTUS_URL = 'https://cms.example.com'
    const { getDirectusImageUrl } = await import('./directus')
    const url = getDirectusImageUrl('abc-123', { width: 800, quality: 80 })
    expect(url).toContain('width=800')
    expect(url).toContain('quality=80')
  })
})
```

- [ ] **Step 3: Esegui il test per verificare che fallisca**

```bash
npx vitest run src/lib/directus.test.ts
```

Atteso: FAIL — `Cannot find module './directus'`

- [ ] **Step 4: Crea `src/lib/directus.ts`**

```typescript
// src/lib/directus.ts
import {
  createDirectus,
  rest,
  readItems,
  readItem,
  readSingleton,
  type RestClient,
} from '@directus/sdk'
import type {
  Post,
  Page,
  PortfolioItem,
  FaqItem,
  SiteSettings,
  Category,
} from './types'

const DIRECTUS_URL = import.meta.env.DIRECTUS_URL ?? process.env.DIRECTUS_URL ?? ''
const DIRECTUS_TOKEN = import.meta.env.DIRECTUS_TOKEN ?? process.env.DIRECTUS_TOKEN ?? ''

let _client: ReturnType<typeof createDirectus> & RestClient<never> | null = null

function getClient() {
  if (!_client) {
    _client = createDirectus(DIRECTUS_URL)
      .with(rest({ onRequest: (options) => ({
        ...options,
        headers: {
          ...options.headers,
          ...(DIRECTUS_TOKEN ? { Authorization: `Bearer ${DIRECTUS_TOKEN}` } : {}),
        },
      })})) as ReturnType<typeof createDirectus> & RestClient<never>
  }
  return _client
}

// --- Image URL helper ---

export function getDirectusImageUrl(
  fileId: string | null | undefined,
  params?: { width?: number; height?: number; quality?: number; fit?: string }
): string {
  if (!fileId) return ''
  const base = `${DIRECTUS_URL}/assets/${fileId}`
  if (!params) return base
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString()
  return query ? `${base}?${query}` : base
}

// --- Query helpers ---

export async function getPosts(options?: { limit?: number; category?: string }): Promise<Post[]> {
  const client = getClient()
  const filter: Record<string, unknown> = { status: { _eq: 'published' } }
  if (options?.category) {
    filter['category'] = { slug: { _eq: options.category } }
  }
  return client.request(
    readItems('posts', {
      filter,
      sort: ['-published_at'],
      limit: options?.limit ?? -1,
      fields: ['id', 'title', 'slug', 'excerpt', 'published_at', 'cover.*', 'category.name', 'category.slug'],
    })
  ) as Promise<Post[]>
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const client = getClient()
  const results = await client.request(
    readItems('posts', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      limit: 1,
      fields: ['*', 'cover.*', 'category.*'],
    })
  ) as Post[]
  return results[0] ?? null
}

export async function getPages(): Promise<Page[]> {
  const client = getClient()
  return client.request(
    readItems('pages', {
      filter: { status: { _eq: 'published' } },
      fields: ['id', 'title', 'slug'],
    })
  ) as Promise<Page[]>
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const client = getClient()
  const results = await client.request(
    readItems('pages', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      limit: 1,
      fields: ['*'],
    })
  ) as Page[]
  return results[0] ?? null
}

export async function getPortfolioItems(options?: { limit?: number }): Promise<PortfolioItem[]> {
  const client = getClient()
  return client.request(
    readItems('portfolio', {
      filter: { status: { _eq: 'published' } },
      sort: ['-year', 'title'],
      limit: options?.limit ?? -1,
      fields: ['id', 'title', 'slug', 'cover.*', 'client', 'year', 'tags'],
    })
  ) as Promise<PortfolioItem[]>
}

export async function getPortfolioItemBySlug(slug: string): Promise<PortfolioItem | null> {
  const client = getClient()
  const results = await client.request(
    readItems('portfolio', {
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      limit: 1,
      fields: ['*', 'cover.*', 'gallery.*'],
    })
  ) as PortfolioItem[]
  return results[0] ?? null
}

export async function getFaqItems(): Promise<FaqItem[]> {
  const client = getClient()
  return client.request(
    readItems('faq', {
      sort: ['sort_order'],
      fields: ['*'],
    })
  ) as Promise<FaqItem[]>
}

export async function getCategories(): Promise<Category[]> {
  const client = getClient()
  return client.request(
    readItems('categories', { fields: ['*'] })
  ) as Promise<Category[]>
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const client = getClient()
  return client.request(
    readSingleton('site_settings', { fields: ['*', 'logo.*'] })
  ) as Promise<SiteSettings>
}
```

- [ ] **Step 5: Esegui i test per verificare che passino**

```bash
npx vitest run src/lib/directus.test.ts
```

Atteso: PASS — 3 test superati.

- [ ] **Step 6: Crea `.env.example`**

```bash
# .env.example
DIRECTUS_URL=https://your-directus-instance.com
DIRECTUS_TOKEN=your-static-token-here
```

- [ ] **Step 7: Crea `.env` locale per sviluppo**

```bash
cp .env.example .env
# Poi modifica .env con i valori reali del tuo Directus locale/staging
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/ .env.example
git commit -m "feat: add Directus SDK client with typed query helpers"
```

---

## Task 4: Configurazione collezioni Directus

**Note:** Questo task configura il backend Directus. Va eseguito nell'admin Directus (`/admin`) o via API. Non produce file nel progetto Astro.

- [ ] **Step 1: Accedi a Directus admin** — `http://your-directus-url/admin`

- [ ] **Step 2: Crea la collezione `categories`**

Vai su Settings → Data Model → Create Collection.
- Name: `categories`
- Fields da aggiungere:
  - `name` — Input (String), required
  - `slug` — Input (String), required, unique

- [ ] **Step 3: Crea la collezione `posts`**

- Name: `posts`
- Enable status field: ✓ (published/draft)
- Fields:
  - `title` — Input (String), required
  - `slug` — Input (String), required, unique
  - `excerpt` — Textarea (String)
  - `content` — WYSIWYG (Text)
  - `cover` — Image (M2O → directus_files)
  - `category` — M2O → categories
  - `published_at` — DateTime
  - `seo_title` — Input (String)
  - `seo_description` — Textarea (String)

- [ ] **Step 4: Crea la collezione `portfolio`**

- Name: `portfolio`
- Enable status field: ✓
- Fields:
  - `title` — Input (String), required
  - `slug` — Input (String), required, unique
  - `description` — WYSIWYG (Text)
  - `cover` — Image (M2O → directus_files)
  - `gallery` — Files (M2M → directus_files)
  - `client` — Input (String)
  - `year` — Input (Integer)
  - `tags` — Tags (CSV)
  - `seo_title` — Input (String)
  - `seo_description` — Textarea (String)

- [ ] **Step 5: Crea la collezione `faq`**

- Name: `faq`
- Sort field: ✓ (abilita drag & drop)
- Fields:
  - `question` — Input (String), required
  - `answer` — WYSIWYG (Text), required
  - `category` — Input (String)

- [ ] **Step 6: Crea la collezione `pages`**

- Name: `pages`
- Enable status field: ✓
- Fields:
  - `title` — Input (String), required
  - `slug` — Input (String), required, unique
  - `blocks` — JSON
  - `seo_title` — Input (String)
  - `seo_description` — Textarea (String)

- [ ] **Step 7: Crea il singleton `site_settings`**

- Name: `site_settings`
- Singleton: ✓ (una sola riga)
- Fields:
  - `site_name` — Input (String), required
  - `logo` — Image (M2O → directus_files)
  - `nav_links` — JSON
  - `social` — JSON
  - `footer_text` — Textarea (String)

- [ ] **Step 8: Configura i permessi per il ruolo Public**

Vai su Settings → Access Control → Public.
Per ogni collezione (`categories`, `posts`, `portfolio`, `faq`, `pages`, `site_settings`):
- Abilita: **Read** (solo i campi necessari, filtrare su `status = published`)

- [ ] **Step 9: Crea un token statico per il frontend**

Vai su Settings → Access Tokens → Create.
- Name: `astro-frontend`
- Copia il token e incollalo nel file `.env` come `DIRECTUS_TOKEN`

---

## Task 5: Layout Base

**Files:**
- Create: `src/layouts/Base.astro`

- [ ] **Step 1: Crea `src/layouts/Base.astro`**

```astro
---
// src/layouts/Base.astro
import '@/styles/global.css'
import { getSiteSettings } from '@/lib/directus'

interface Props {
  title?: string
  description?: string
  image?: string
}

const settings = await getSiteSettings().catch(() => ({
  site_name: 'Sito',
  logo: null,
  nav_links: [],
  social: [],
  footer_text: null,
}))

const {
  title = settings.site_name,
  description = '',
  image = '',
} = Astro.props

const pageTitle = title === settings.site_name
  ? settings.site_name
  : `${title} — ${settings.site_name}`
---

<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    {image && <meta property="og:image" content={image} />}
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <title>{pageTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <slot />
    <script>
      import { initAnimations } from '@/animations/gsap'
      initAnimations()
    </script>
  </body>
</html>
```

- [ ] **Step 2: Verifica TypeScript**

```bash
npx astro check
```

Atteso: 0 errori (ignorare warning su moduli non ancora creati).

- [ ] **Step 3: Commit**

```bash
git add src/layouts/Base.astro
git commit -m "feat: add Base layout with meta tags and font loading"
```

---

## Task 6: Componenti layout (Header, Nav, Footer)

**Files:**
- Create: `src/components/layout/Header.astro`
- Create: `src/components/layout/Nav.astro`
- Create: `src/components/layout/Footer.astro`

- [ ] **Step 1: Crea `src/components/layout/Nav.astro`**

```astro
---
// src/components/layout/Nav.astro
interface Props {
  links: Array<{ label: string; url: string }>
  currentPath: string
}
const { links, currentPath } = Astro.props
---

<nav class="nav" aria-label="Navigazione principale">
  <ul class="flex items-center gap-6 list-none m-0 p-0">
    {links.map((link) => (
      <li>
        <a
          href={link.url}
          class:list={[
            'text-sm font-medium transition-colors duration-200 hover:text-[var(--color-brand)]',
            currentPath === link.url
              ? 'text-[var(--color-brand)]'
              : 'text-[var(--color-text)]',
          ]}
          aria-current={currentPath === link.url ? 'page' : undefined}
        >
          {link.label}
        </a>
      </li>
    ))}
  </ul>
</nav>
```

- [ ] **Step 2: Crea `src/components/layout/Header.astro`**

```astro
---
// src/components/layout/Header.astro
import Nav from './Nav.astro'
import { getSiteSettings } from '@/lib/directus'
import { getDirectusImageUrl } from '@/lib/directus'

const settings = await getSiteSettings().catch(() => ({
  site_name: 'Sito',
  logo: null,
  nav_links: [],
  social: [],
  footer_text: null,
}))

const navLinks = settings.nav_links ?? []
const currentPath = Astro.url.pathname
---

<header class="header sticky top-0 z-50 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
  <div class="container flex items-center justify-between py-4">
    <a href="/" class="flex items-center gap-2 font-semibold text-lg">
      {settings.logo
        ? <img src={getDirectusImageUrl(settings.logo.id, { height: 40 })} alt={settings.site_name} class="h-10 w-auto" />
        : <span>{settings.site_name}</span>
      }
    </a>
    <Nav links={navLinks} currentPath={currentPath} />
  </div>
</header>
```

- [ ] **Step 3: Crea `src/components/layout/Footer.astro`**

```astro
---
// src/components/layout/Footer.astro
import { getSiteSettings } from '@/lib/directus'

const settings = await getSiteSettings().catch(() => ({
  site_name: 'Sito',
  logo: null,
  nav_links: [],
  social: [],
  footer_text: 'Tutti i diritti riservati.',
}))

const currentYear = new Date().getFullYear()
---

<footer class="footer border-t border-[var(--color-border)] py-8 mt-16">
  <div class="container flex flex-col sm:flex-row items-center justify-between gap-4">
    <p class="text-sm text-[var(--color-muted)]">
      &copy; {currentYear} {settings.site_name}. {settings.footer_text}
    </p>
    {settings.social && settings.social.length > 0 && (
      <ul class="flex items-center gap-4 list-none m-0 p-0">
        {settings.social.map((item) => (
          <li>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors"
            >
              {item.platform}
            </a>
          </li>
        ))}
      </ul>
    )}
  </div>
</footer>
```

- [ ] **Step 4: Verifica TypeScript**

```bash
npx astro check
```

Atteso: 0 errori.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add Header, Nav, and Footer layout components"
```

---

## Task 7: Componenti UI primitivi

**Files:**
- Create: `src/components/ui/Button.astro`
- Create: `src/components/ui/Card.astro`
- Create: `src/components/ui/Badge.astro`

- [ ] **Step 1: Crea `src/components/ui/Button.astro`**

```astro
---
// src/components/ui/Button.astro
interface Props {
  href?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  class?: string
}
const { href, variant = 'primary', size = 'md', class: className } = Astro.props

const baseClasses = 'inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] transition-all duration-200 no-underline'

const variantClasses = {
  primary: 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]',
  secondary: 'bg-transparent border-2 border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white',
  ghost: 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface)]',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className].filter(Boolean).join(' ')
---

{href
  ? <a href={href} class={classes}><slot /></a>
  : <button class={classes} type="button"><slot /></button>
}
```

- [ ] **Step 2: Crea `src/components/ui/Card.astro`**

```astro
---
// src/components/ui/Card.astro
interface Props {
  href?: string
  class?: string
}
const { href, class: className } = Astro.props
const baseClasses = 'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden'
const hoverClasses = href ? 'transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer' : ''
const classes = [baseClasses, hoverClasses, className].filter(Boolean).join(' ')
---

{href
  ? <a href={href} class={classes}><slot /></a>
  : <div class={classes}><slot /></div>
}
```

- [ ] **Step 3: Crea `src/components/ui/Badge.astro`**

```astro
---
// src/components/ui/Badge.astro
interface Props {
  variant?: 'default' | 'brand' | 'accent'
  class?: string
}
const { variant = 'default', class: className } = Astro.props

const variantClasses = {
  default: 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]',
  brand: 'bg-[var(--color-brand)] text-white',
  accent: 'bg-[var(--color-accent)] text-white',
}
const classes = ['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variantClasses[variant], className].filter(Boolean).join(' ')
---

<span class={classes}><slot /></span>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add Button, Card, Badge UI primitives"
```

---

## Task 8: Block components (Hero, Features, CTA, Testimonials)

**Files:**
- Create: `src/components/blocks/Hero.astro`
- Create: `src/components/blocks/Features.astro`
- Create: `src/components/blocks/CTA.astro`
- Create: `src/components/blocks/Testimonials.astro`

- [ ] **Step 1: Crea `src/components/blocks/Hero.astro`**

```astro
---
// src/components/blocks/Hero.astro
import Button from '@/components/ui/Button.astro'

interface Props {
  title: string
  subtitle?: string
  cta_label?: string
  cta_url?: string
  cta_secondary_label?: string
  cta_secondary_url?: string
  image_url?: string
}

const {
  title,
  subtitle,
  cta_label,
  cta_url,
  cta_secondary_label,
  cta_secondary_url,
  image_url,
} = Astro.props
---

<section class="hero py-[var(--spacing-section)] overflow-hidden" data-animate="hero">
  <div class="container">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div class="hero__content" data-animate="fade-up">
        <h1 class="text-4xl lg:text-6xl font-bold leading-tight mb-6">
          {title}
        </h1>
        {subtitle && (
          <p class="text-xl text-[var(--color-muted)] mb-8 max-w-xl">
            {subtitle}
          </p>
        )}
        {(cta_label || cta_secondary_label) && (
          <div class="flex flex-wrap gap-4">
            {cta_label && cta_url && (
              <Button href={cta_url} variant="primary" size="lg">{cta_label}</Button>
            )}
            {cta_secondary_label && cta_secondary_url && (
              <Button href={cta_secondary_url} variant="secondary" size="lg">{cta_secondary_label}</Button>
            )}
          </div>
        )}
      </div>
      {image_url && (
        <div class="hero__image" data-animate="fade-in">
          <img
            src={image_url}
            alt={title}
            class="w-full rounded-[var(--radius-lg)] shadow-2xl"
            loading="eager"
          />
        </div>
      )}
    </div>
  </div>
</section>
```

- [ ] **Step 2: Crea `src/components/blocks/Features.astro`**

```astro
---
// src/components/blocks/Features.astro

interface Feature {
  icon?: string
  title: string
  description: string
}

interface Props {
  title?: string
  subtitle?: string
  features: Feature[]
  columns?: 2 | 3 | 4
}

const { title, subtitle, features, columns = 3 } = Astro.props

const gridCols = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}
---

<section class="features py-[var(--spacing-section)]">
  <div class="container">
    {(title || subtitle) && (
      <div class="text-center mb-12" data-animate="fade-up">
        {title && <h2 class="text-3xl lg:text-4xl font-bold mb-4">{title}</h2>}
        {subtitle && <p class="text-lg text-[var(--color-muted)] max-w-2xl mx-auto">{subtitle}</p>}
      </div>
    )}
    <div class={`grid ${gridCols[columns]} gap-8`} data-animate="stagger">
      {features.map((feature) => (
        <div class="feature-item p-6 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)]">
          {feature.icon && (
            <div class="text-3xl mb-4">{feature.icon}</div>
          )}
          <h3 class="text-xl font-semibold mb-2">{feature.title}</h3>
          <p class="text-[var(--color-muted)]">{feature.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Crea `src/components/blocks/CTA.astro`**

```astro
---
// src/components/blocks/CTA.astro
import Button from '@/components/ui/Button.astro'

interface Props {
  title: string
  subtitle?: string
  cta_label: string
  cta_url: string
  background?: 'brand' | 'surface' | 'dark'
}

const { title, subtitle, cta_label, cta_url, background = 'brand' } = Astro.props

const bgClasses = {
  brand: 'bg-[var(--color-brand)] text-white',
  surface: 'bg-[var(--color-surface)]',
  dark: 'bg-[#111] text-white',
}
---

<section class={`cta py-[var(--spacing-section)] ${bgClasses[background]}`} data-animate="fade-up">
  <div class="container text-center">
    <h2 class="text-3xl lg:text-4xl font-bold mb-4">{title}</h2>
    {subtitle && (
      <p class="text-lg mb-8 opacity-80 max-w-xl mx-auto">{subtitle}</p>
    )}
    <Button
      href={cta_url}
      variant={background === 'brand' ? 'secondary' : 'primary'}
      size="lg"
    >
      {cta_label}
    </Button>
  </div>
</section>
```

- [ ] **Step 4: Crea `src/components/blocks/Testimonials.astro`**

```astro
---
// src/components/blocks/Testimonials.astro

interface Testimonial {
  quote: string
  author: string
  role?: string
  avatar_url?: string
}

interface Props {
  title?: string
  testimonials: Testimonial[]
}

const { title, testimonials } = Astro.props
---

<section class="testimonials py-[var(--spacing-section)]">
  <div class="container">
    {title && (
      <h2 class="text-3xl lg:text-4xl font-bold text-center mb-12" data-animate="fade-up">
        {title}
      </h2>
    )}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-animate="stagger">
      {testimonials.map((t) => (
        <blockquote class="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <p class="text-[var(--color-text)] mb-6 leading-relaxed">"{t.quote}"</p>
          <footer class="flex items-center gap-3">
            {t.avatar_url && (
              <img src={t.avatar_url} alt={t.author} class="w-10 h-10 rounded-full object-cover" />
            )}
            <div>
              <div class="font-semibold text-sm">{t.author}</div>
              {t.role && <div class="text-xs text-[var(--color-muted)]">{t.role}</div>}
            </div>
          </footer>
        </blockquote>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/blocks/Hero.astro src/components/blocks/Features.astro src/components/blocks/CTA.astro src/components/blocks/Testimonials.astro
git commit -m "feat: add Hero, Features, CTA, Testimonials block components"
```

---

## Task 9: Block components (BlogGrid, PortfolioGrid, FaqAccordion)

**Files:**
- Create: `src/components/blocks/BlogGrid.astro`
- Create: `src/components/blocks/PortfolioGrid.astro`
- Create: `src/components/blocks/FaqAccordion.astro`

- [ ] **Step 1: Crea `src/components/blocks/BlogGrid.astro`**

```astro
---
// src/components/blocks/BlogGrid.astro
import Card from '@/components/ui/Card.astro'
import Badge from '@/components/ui/Badge.astro'
import type { Post } from '@/lib/types'
import { getDirectusImageUrl } from '@/lib/directus'

interface Props {
  posts: Post[]
  title?: string
}

const { posts, title } = Astro.props
---

<section class="blog-grid py-[var(--spacing-section)]">
  <div class="container">
    {title && (
      <h2 class="text-3xl font-bold mb-10" data-animate="fade-up">{title}</h2>
    )}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-animate="stagger">
      {posts.map((post) => (
        <Card href={`/blog/${post.slug}`}>
          {post.cover && (
            <img
              src={getDirectusImageUrl(post.cover.id, { width: 600, height: 340, fit: 'cover' })}
              alt={post.cover.title ?? post.title}
              class="w-full h-48 object-cover"
              loading="lazy"
            />
          )}
          <div class="p-5">
            {post.category && (
              <Badge variant="brand" class="mb-3">{post.category.name}</Badge>
            )}
            <h3 class="text-lg font-semibold mb-2 leading-snug">{post.title}</h3>
            {post.excerpt && (
              <p class="text-sm text-[var(--color-muted)] line-clamp-2">{post.excerpt}</p>
            )}
            <time class="block text-xs text-[var(--color-muted)] mt-3">
              {new Date(post.published_at).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </div>
        </Card>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 2: Crea `src/components/blocks/PortfolioGrid.astro`**

```astro
---
// src/components/blocks/PortfolioGrid.astro
import Card from '@/components/ui/Card.astro'
import Badge from '@/components/ui/Badge.astro'
import type { PortfolioItem } from '@/lib/types'
import { getDirectusImageUrl } from '@/lib/directus'

interface Props {
  items: PortfolioItem[]
  title?: string
}

const { items, title } = Astro.props
---

<section class="portfolio-grid py-[var(--spacing-section)]">
  <div class="container">
    {title && (
      <h2 class="text-3xl font-bold mb-10" data-animate="fade-up">{title}</h2>
    )}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-animate="stagger">
      {items.map((item) => (
        <Card href={`/portfolio/${item.slug}`}>
          {item.cover && (
            <img
              src={getDirectusImageUrl(item.cover.id, { width: 600, height: 400, fit: 'cover' })}
              alt={item.cover.title ?? item.title}
              class="w-full h-56 object-cover"
              loading="lazy"
            />
          )}
          <div class="p-5">
            <h3 class="text-lg font-semibold mb-2">{item.title}</h3>
            <div class="flex flex-wrap items-center gap-2 mt-2">
              {item.client && (
                <span class="text-xs text-[var(--color-muted)]">{item.client}</span>
              )}
              {item.year && (
                <span class="text-xs text-[var(--color-muted)]">· {item.year}</span>
              )}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div class="flex flex-wrap gap-1 mt-3">
                {item.tags.slice(0, 3).map((tag) => (
                  <Badge>{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Crea `src/components/blocks/FaqAccordion.astro`**

```astro
---
// src/components/blocks/FaqAccordion.astro
import type { FaqItem } from '@/lib/types'

interface Props {
  items: FaqItem[]
  title?: string
}

const { items, title } = Astro.props
---

<section class="faq py-[var(--spacing-section)]">
  <div class="container max-w-3xl mx-auto">
    {title && (
      <h2 class="text-3xl font-bold text-center mb-10" data-animate="fade-up">{title}</h2>
    )}
    <div class="faq-list space-y-3" data-animate="stagger">
      {items.map((item) => (
        <details class="faq-item border border-[var(--color-border)] rounded-[var(--radius-md)] group">
          <summary class="flex items-center justify-between p-5 cursor-pointer font-medium select-none list-none">
            {item.question}
            <span class="text-[var(--color-brand)] transition-transform duration-300 group-open:rotate-45 flex-shrink-0 ml-4">＋</span>
          </summary>
          <div class="px-5 pb-5 text-[var(--color-muted)] leading-relaxed">
            <Fragment set:html={item.answer} />
          </div>
        </details>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/blocks/BlogGrid.astro src/components/blocks/PortfolioGrid.astro src/components/blocks/FaqAccordion.astro
git commit -m "feat: add BlogGrid, PortfolioGrid, FaqAccordion block components"
```

---

## Task 10: Layout Page e Post

**Files:**
- Create: `src/layouts/Page.astro`
- Create: `src/layouts/Post.astro`

- [ ] **Step 1: Crea `src/layouts/Page.astro`**

```astro
---
// src/layouts/Page.astro
import Base from './Base.astro'
import Header from '@/components/layout/Header.astro'
import Footer from '@/components/layout/Footer.astro'

interface Props {
  title?: string
  description?: string
  image?: string
}

const { title, description, image } = Astro.props
---

<Base title={title} description={description} image={image}>
  <Header />
  <main>
    <slot />
  </main>
  <Footer />
</Base>
```

- [ ] **Step 2: Crea `src/layouts/Post.astro`**

```astro
---
// src/layouts/Post.astro
import Base from './Base.astro'
import Header from '@/components/layout/Header.astro'
import Footer from '@/components/layout/Footer.astro'
import type { Post } from '@/lib/types'
import { getDirectusImageUrl } from '@/lib/directus'

interface Props {
  post: Post
}

const { post } = Astro.props
const coverUrl = post.cover ? getDirectusImageUrl(post.cover.id, { width: 1200, height: 630, fit: 'cover' }) : ''
---

<Base
  title={post.seo_title ?? post.title}
  description={post.seo_description ?? post.excerpt ?? ''}
  image={coverUrl}
>
  <Header />
  <main>
    <article class="py-[var(--spacing-section)]">
      <div class="container max-w-3xl mx-auto">
        {post.category && (
          <a
            href={`/blog?categoria=${post.category.slug}`}
            class="text-sm font-medium text-[var(--color-brand)] hover:underline"
          >
            {post.category.name}
          </a>
        )}
        <h1 class="text-4xl lg:text-5xl font-bold mt-3 mb-4" data-animate="fade-up">
          {post.title}
        </h1>
        <time class="text-sm text-[var(--color-muted)] block mb-8">
          {new Date(post.published_at).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
        {post.cover && (
          <img
            src={coverUrl}
            alt={post.cover.title ?? post.title}
            class="w-full rounded-[var(--radius-lg)] mb-10 shadow-lg"
          />
        )}
        <div class="prose prose-lg max-w-none" set:html={post.content} />
      </div>
    </article>
  </main>
  <Footer />
</Base>
```

- [ ] **Step 3: Commit**

```bash
git add src/layouts/Page.astro src/layouts/Post.astro
git commit -m "feat: add Page and Post layouts"
```

---

## Task 11: Pagine Blog

**Files:**
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[slug].astro`

- [ ] **Step 1: Crea `src/pages/blog/index.astro`**

```astro
---
// src/pages/blog/index.astro
import Page from '@/layouts/Page.astro'
import BlogGrid from '@/components/blocks/BlogGrid.astro'
import { getPosts } from '@/lib/directus'

const posts = await getPosts()
---

<Page title="Blog" description="Tutti gli articoli del blog">
  <section class="py-[var(--spacing-section)]">
    <div class="container">
      <h1 class="text-4xl font-bold mb-4" data-animate="fade-up">Blog</h1>
    </div>
  </section>
  <BlogGrid posts={posts} />
</Page>
```

- [ ] **Step 2: Crea `src/pages/blog/[slug].astro`**

```astro
---
// src/pages/blog/[slug].astro
import Post from '@/layouts/Post.astro'
import { getPosts, getPostBySlug } from '@/lib/directus'

export async function getStaticPaths() {
  const posts = await getPosts()
  return posts.map((post) => ({
    params: { slug: post.slug },
  }))
}

const { slug } = Astro.params
const post = await getPostBySlug(slug)

if (!post) {
  return Astro.redirect('/blog')
}
---

<Post post={post} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/blog/
git commit -m "feat: add blog index and single post pages"
```

---

## Task 12: Pagine Portfolio

**Files:**
- Create: `src/pages/portfolio/index.astro`
- Create: `src/pages/portfolio/[slug].astro`

- [ ] **Step 1: Crea `src/pages/portfolio/index.astro`**

```astro
---
// src/pages/portfolio/index.astro
import Page from '@/layouts/Page.astro'
import PortfolioGrid from '@/components/blocks/PortfolioGrid.astro'
import { getPortfolioItems } from '@/lib/directus'

const items = await getPortfolioItems()
---

<Page title="Portfolio" description="I nostri progetti">
  <section class="py-[var(--spacing-section)]">
    <div class="container">
      <h1 class="text-4xl font-bold mb-4" data-animate="fade-up">Portfolio</h1>
    </div>
  </section>
  <PortfolioGrid items={items} />
</Page>
```

- [ ] **Step 2: Crea `src/pages/portfolio/[slug].astro`**

```astro
---
// src/pages/portfolio/[slug].astro
import Page from '@/layouts/Page.astro'
import { getPortfolioItems, getPortfolioItemBySlug, getDirectusImageUrl } from '@/lib/directus'

export async function getStaticPaths() {
  const items = await getPortfolioItems()
  return items.map((item) => ({
    params: { slug: item.slug },
  }))
}

const { slug } = Astro.params
const item = await getPortfolioItemBySlug(slug)

if (!item) {
  return Astro.redirect('/portfolio')
}

const coverUrl = item.cover ? getDirectusImageUrl(item.cover.id, { width: 1200 }) : ''
---

<Page title={item.title} description={item.description?.slice(0, 160)} image={coverUrl}>
  <article class="py-[var(--spacing-section)]">
    <div class="container max-w-4xl mx-auto">
      <h1 class="text-4xl lg:text-5xl font-bold mb-4" data-animate="fade-up">{item.title}</h1>
      <div class="flex flex-wrap gap-4 text-sm text-[var(--color-muted)] mb-8">
        {item.client && <span>Cliente: <strong>{item.client}</strong></span>}
        {item.year && <span>Anno: <strong>{item.year}</strong></span>}
      </div>
      {item.cover && (
        <img
          src={coverUrl}
          alt={item.cover.title ?? item.title}
          class="w-full rounded-[var(--radius-lg)] mb-10 shadow-lg"
        />
      )}
      <div class="prose prose-lg max-w-none mb-12" set:html={item.description} />
      {item.gallery && item.gallery.length > 0 && (
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {item.gallery.map((file) => (
            <img
              src={getDirectusImageUrl(file.id, { width: 800 })}
              alt={file.title ?? ''}
              class="rounded-[var(--radius-md)] w-full"
              loading="lazy"
            />
          ))}
        </div>
      )}
    </div>
  </article>
</Page>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/portfolio/
git commit -m "feat: add portfolio index and single item pages"
```

---

## Task 13: Pagine dinamiche e Homepage

**Files:**
- Create: `src/pages/[slug].astro`
- Create: `src/pages/index.astro`

- [ ] **Step 1: Crea `src/pages/[slug].astro`**

```astro
---
// src/pages/[slug].astro
import Page from '@/layouts/Page.astro'
import Hero from '@/components/blocks/Hero.astro'
import Features from '@/components/blocks/Features.astro'
import CTA from '@/components/blocks/CTA.astro'
import Testimonials from '@/components/blocks/Testimonials.astro'
import BlogGrid from '@/components/blocks/BlogGrid.astro'
import PortfolioGrid from '@/components/blocks/PortfolioGrid.astro'
import FaqAccordion from '@/components/blocks/FaqAccordion.astro'
import { getPages, getPageBySlug } from '@/lib/directus'
import type { PageBlock } from '@/lib/types'

export async function getStaticPaths() {
  const pages = await getPages()
  return pages
    .filter((p) => p.slug !== 'home')
    .map((page) => ({ params: { slug: page.slug } }))
}

const { slug } = Astro.params
const page = await getPageBySlug(slug)

if (!page) {
  return Astro.redirect('/')
}

const blocks: PageBlock[] = page.blocks ?? []
---

<Page
  title={page.seo_title ?? page.title}
  description={page.seo_description ?? ''}
>
  {blocks.map((block) => {
    const d = block.data as Record<string, unknown>
    if (block.type === 'hero') return <Hero {...d as Parameters<typeof Hero>[0]} />
    if (block.type === 'features') return <Features {...d as Parameters<typeof Features>[0]} />
    if (block.type === 'cta') return <CTA {...d as Parameters<typeof CTA>[0]} />
    if (block.type === 'testimonials') return <Testimonials {...d as Parameters<typeof Testimonials>[0]} />
    if (block.type === 'blog_grid') return <BlogGrid {...d as Parameters<typeof BlogGrid>[0]} />
    if (block.type === 'portfolio_grid') return <PortfolioGrid {...d as Parameters<typeof PortfolioGrid>[0]} />
    if (block.type === 'faq') return <FaqAccordion {...d as Parameters<typeof FaqAccordion>[0]} />
    return null
  })}
</Page>
```

- [ ] **Step 2: Crea `src/pages/index.astro`**

```astro
---
// src/pages/index.astro
import Page from '@/layouts/Page.astro'
import Hero from '@/components/blocks/Hero.astro'
import Features from '@/components/blocks/Features.astro'
import CTA from '@/components/blocks/CTA.astro'
import Testimonials from '@/components/blocks/Testimonials.astro'
import BlogGrid from '@/components/blocks/BlogGrid.astro'
import PortfolioGrid from '@/components/blocks/PortfolioGrid.astro'
import FaqAccordion from '@/components/blocks/FaqAccordion.astro'
import { getPageBySlug } from '@/lib/directus'
import type { PageBlock } from '@/lib/types'

const page = await getPageBySlug('home')
const blocks: PageBlock[] = page?.blocks ?? []
const title = page?.seo_title ?? page?.title ?? undefined
const description = page?.seo_description ?? undefined
---

<Page title={title} description={description}>
  {blocks.map((block) => {
    const d = block.data as Record<string, unknown>
    if (block.type === 'hero') return <Hero {...d as Parameters<typeof Hero>[0]} />
    if (block.type === 'features') return <Features {...d as Parameters<typeof Features>[0]} />
    if (block.type === 'cta') return <CTA {...d as Parameters<typeof CTA>[0]} />
    if (block.type === 'testimonials') return <Testimonials {...d as Parameters<typeof Testimonials>[0]} />
    if (block.type === 'blog_grid') return <BlogGrid {...d as Parameters<typeof BlogGrid>[0]} />
    if (block.type === 'portfolio_grid') return <PortfolioGrid {...d as Parameters<typeof PortfolioGrid>[0]} />
    if (block.type === 'faq') return <FaqAccordion {...d as Parameters<typeof FaqAccordion>[0]} />
    return null
  })}
</Page>
```

- [ ] **Step 3: Esegui il type check**

```bash
npx astro check
```

Atteso: 0 errori.

- [ ] **Step 4: Commit**

```bash
git add src/pages/
git commit -m "feat: add dynamic pages and homepage with block renderer"
```

---

## Task 14: Sistema animazioni GSAP + Lenis

**Files:**
- Create: `src/animations/gsap.ts`
- Create: `src/animations/presets.ts`

- [ ] **Step 1: Crea `src/animations/presets.ts`**

```typescript
// src/animations/presets.ts
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export type AnimationStyle = 'elegant' | 'bold' | 'premium' | 'editorial'

function getAnimationStyle(): AnimationStyle {
  if (typeof document === 'undefined') return 'elegant'
  const style = getComputedStyle(document.documentElement)
    .getPropertyValue('--animation-style')
    .trim()
  return (style as AnimationStyle) || 'elegant'
}

// Durata e easing per preset
const config: Record<AnimationStyle, { duration: number; ease: string; staggerDelay: number }> = {
  elegant:  { duration: 0.8, ease: 'power2.out',     staggerDelay: 0.12 },
  bold:     { duration: 0.6, ease: 'back.out(1.5)',   staggerDelay: 0.08 },
  premium:  { duration: 1.2, ease: 'expo.out',        staggerDelay: 0.15 },
  editorial:{ duration: 0.5, ease: 'power1.inOut',    staggerDelay: 0.06 },
}

export function fadeUp(element: Element | string, delay = 0) {
  const style = getAnimationStyle()
  const { duration, ease } = config[style]
  return gsap.fromTo(
    element,
    { opacity: 0, y: style === 'bold' ? 50 : 30 },
    {
      opacity: 1,
      y: 0,
      duration,
      ease,
      delay,
      scrollTrigger: {
        trigger: element as Element,
        start: 'top 85%',
        once: true,
      },
    }
  )
}

export function staggerIn(elements: Element[] | string, delay = 0) {
  const style = getAnimationStyle()
  const { duration, ease, staggerDelay } = config[style]
  return gsap.fromTo(
    elements,
    { opacity: 0, y: 25 },
    {
      opacity: 1,
      y: 0,
      duration,
      ease,
      delay,
      stagger: staggerDelay,
      scrollTrigger: {
        trigger: typeof elements === 'string' ? elements : (elements[0] as Element),
        start: 'top 85%',
        once: true,
      },
    }
  )
}

export function splitTitle(element: Element) {
  const style = getAnimationStyle()
  if (style === 'elegant' || style === 'editorial') {
    // Fade semplice per elegant ed editorial
    return fadeUp(element)
  }
  // Bold e premium: animazione per parole
  const split = new SplitText(element, { type: 'words' })
  const { duration, ease } = config[style]
  return gsap.fromTo(
    split.words,
    { opacity: 0, y: 40, rotateX: -15 },
    {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration,
      ease,
      stagger: 0.06,
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        once: true,
      },
    }
  )
}

export function parallax(element: Element, strength = 0.15) {
  const style = getAnimationStyle()
  if (style === 'editorial') return // editorial non usa parallax
  const yAmount = style === 'premium' ? strength * 120 : strength * 60
  return gsap.to(element, {
    yPercent: yAmount,
    ease: 'none',
    scrollTrigger: {
      trigger: element,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  })
}
```

- [ ] **Step 2: Crea `src/animations/gsap.ts`**

```typescript
// src/animations/gsap.ts
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { fadeUp, staggerIn, splitTitle } from './presets'

export function initAnimations() {
  if (typeof window === 'undefined') return

  gsap.registerPlugin(ScrollTrigger)

  // Lenis smooth scroll
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  })

  function raf(time: number) {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  // Connetti Lenis a GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000)
  })
  gsap.ticker.lagSmoothing(0)

  // Applica animazioni agli elementi con data-animate
  document.querySelectorAll('[data-animate="fade-up"]').forEach((el) => {
    fadeUp(el)
  })

  document.querySelectorAll('[data-animate="stagger"]').forEach((container) => {
    const children = Array.from(container.children)
    if (children.length > 0) staggerIn(children)
  })

  document.querySelectorAll('[data-animate="split-title"]').forEach((el) => {
    splitTitle(el)
  })

  document.querySelectorAll('[data-animate="fade-in"]').forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 1,
        scrollTrigger: { trigger: el as Element, start: 'top 85%', once: true },
      }
    )
  })
}
```

- [ ] **Step 3: Verifica build**

```bash
npm run build
```

Atteso: build completata. Eventuali warning su GSAP (SSR) sono attesi — il codice gira solo client-side.

- [ ] **Step 4: Commit**

```bash
git add src/animations/
git commit -m "feat: add GSAP + Lenis animation system with 4 style presets"
```

---

## Task 15: Configurazione Netlify, .env e deploy

**Files:**
- Create: `netlify.toml`
- Update: `.gitignore`

- [ ] **Step 1: Crea `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  conditions = {Role = ["admin"]}

[context.production.environment]
  ASTRO_TELEMETRY_DISABLED = "1"
```

- [ ] **Step 2: Aggiorna `.gitignore`**

```
# .gitignore
node_modules/
dist/
.env
.env.local
.astro/
.superpowers/
```

- [ ] **Step 3: Crea il repo su GitHub**

```bash
# Crea repo su github.com, poi:
git remote add origin https://github.com/TUO-USERNAME/astro-directus-starter.git
git branch -M main
git push -u origin main
```

- [ ] **Step 4: Collega il repo a Netlify**

1. Vai su [app.netlify.com](https://app.netlify.com) → Add new site → Import an existing project
2. Seleziona GitHub → scegli `astro-directus-starter`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Aggiungi variabili d'ambiente: `DIRECTUS_URL` e `DIRECTUS_TOKEN`
6. Click **Deploy site**

- [ ] **Step 5: Configura il webhook Directus → Netlify**

In Netlify: Site settings → Build & deploy → Build hooks → Add build hook
- Name: `directus-publish`
- Branch: `main`
- Copia l'URL generato (es. `https://api.netlify.com/build_hooks/xxxxxxxxx`)

In Directus: Settings → Flows → Create flow
- Trigger: `Action (non-blocking)` su collections `posts`, `pages`, `portfolio`
- Action: HTTP Request (POST) all'URL del build hook Netlify

- [ ] **Step 6: Verifica deploy**

Dopo il primo deploy, apri l'URL Netlify (es. `https://mio-sito.netlify.app`) e verifica che il sito sia accessibile.

- [ ] **Step 7: Commit finale**

```bash
git add netlify.toml .gitignore
git commit -m "feat: add Netlify config and deploy pipeline"
git push
```

---

## Checklist di verifica finale

- [ ] `npm run build` completa senza errori
- [ ] `npx astro check` — 0 errori TypeScript
- [ ] `npm test` — tutti i test Vitest passano
- [ ] Dev server (`npm run dev`) mostra la homepage senza errori console
- [ ] Netlify deploy completato con successo
- [ ] Webhook Directus → Netlify funzionante (pubblica un post, verifica rebuild)
- [ ] Dominio custom configurato in Netlify con SSL attivo
- [ ] Per nuovo cliente: cambio di `theme.css` + `.env` produce sito con veste grafica diversa
