# Admin Panel — Piano 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire l'auth admin con Directus JWT, aggiungere middleware di protezione per `/admin/*`, creare `AdminLayout.astro` con sidebar a icone espandibile, creare `DataTable.astro` riutilizzabile, aggiornare login e dashboard esistenti.

**Architecture:** Astro SSR (output statico con prerender=false per le pagine admin). Il middleware Astro intercetta tutte le richieste `/admin/*` e verifica il cookie `admin_token`. L'auth API chiama Directus `/auth/login` e salva access_token + refresh_token in cookie httpOnly. AdminLayout è un layout Astro che wrappa ogni pagina admin con sidebar + main content.

**Tech Stack:** Astro SSR, Tailwind CSS (già installato), Directus REST API (`/auth/login`, `/auth/refresh`, `/users/me`)

**Spec di riferimento:** `docs/superpowers/specs/2026-06-02-admin-panel-design.md`

---

## File Structure

```
src/
  middleware.ts                          ← NUOVO: protegge /admin/* con cookie check
  layouts/
    AdminLayout.astro                   ← NUOVO: sidebar + main shell per tutte le pagine admin
  components/
    admin/
      DataTable.astro                   ← NUOVO: tabella generica con scroll orizzontale
  pages/
    admin/
      login.astro                       ← MODIFICA: email+password → Directus JWT
      index.astro                       ← MODIFICA: usa AdminLayout, rimuove ADMIN_KEY check
    api/
      admin/
        auth.ts                         ← MODIFICA: sostituisce ADMIN_KEY con Directus JWT
```

---

## Task 1: Nuovo endpoint auth con Directus JWT

**Files:**
- Modify: `src/pages/api/admin/auth.ts`

> **Contesto:** L'attuale endpoint usa `ADMIN_KEY` (una password statica). Lo sostituiamo con autenticazione Directus reale: email + password → JWT. I cookie cambiano da `admin_session` a `admin_token` (access) + `admin_refresh` (refresh).

- [ ] **Step 1: Sostituire `src/pages/api/admin/auth.ts` con il nuovo codice**

```typescript
// src/pages/api/admin/auth.ts
export const prerender = false

import type { APIRoute } from 'astro'

const DIRECTUS_URL = () => process.env.DIRECTUS_URL ?? ''

export const POST: APIRoute = async ({ request, cookies }) => {
  const url = DIRECTUS_URL()
  if (!url) {
    return new Response(JSON.stringify({ error: 'DIRECTUS_URL non configurata' }), { status: 503 })
  }

  let body: { email?: string; password?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }

  if (!body.email || !body.password) {
    return new Response(JSON.stringify({ error: 'Email e password obbligatorie' }), { status: 400 })
  }

  const res = await fetch(`${url}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Credenziali non valide' }), { status: 401 })
  }

  const { data } = await res.json() as { data: { access_token: string; refresh_token: string; expires: number } }

  const cookieOpts = {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    path: '/',
  }

  cookies.set('admin_token', data.access_token, { ...cookieOpts, maxAge: 900 })
  cookies.set('admin_refresh', data.refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

export const DELETE: APIRoute = async ({ cookies }) => {
  const token = cookies.get('admin_token')?.value
  const url = DIRECTUS_URL()

  if (token && url) {
    await fetch(`${url}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: cookies.get('admin_refresh')?.value }),
    }).catch(() => {})
  }

  cookies.delete('admin_token', { path: '/' })
  cookies.delete('admin_refresh', { path: '/' })
  // Rimuove il vecchio cookie per retrocompatibilità
  cookies.delete('admin_session', { path: '/' })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

// Refresh: usato dal middleware
export const PATCH: APIRoute = async ({ cookies }) => {
  const refreshToken = cookies.get('admin_refresh')?.value
  const url = DIRECTUS_URL()

  if (!refreshToken || !url) {
    return new Response(JSON.stringify({ error: 'No refresh token' }), { status: 401 })
  }

  const res = await fetch(`${url}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
  })

  if (!res.ok) {
    cookies.delete('admin_token', { path: '/' })
    cookies.delete('admin_refresh', { path: '/' })
    return new Response(JSON.stringify({ error: 'Refresh fallito' }), { status: 401 })
  }

  const { data } = await res.json() as { data: { access_token: string; refresh_token: string } }

  const cookieOpts = {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    path: '/',
  }

  cookies.set('admin_token', data.access_token, { ...cookieOpts, maxAge: 900 })
  cookies.set('admin_refresh', data.refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
```

- [ ] **Step 2: Verificare che il file sia corretto**

```bash
npx tsc --noEmit
```
Expected: nessun errore TypeScript sul file modificato.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/auth.ts
git commit -m "feat(admin): replace ADMIN_KEY auth with Directus JWT"
```

---

## Task 2: Middleware Astro per protezione /admin/*

**Files:**
- Create: `src/middleware.ts`

> **Contesto:** Astro supporta middleware in `src/middleware.ts`. Viene eseguito su tutte le route SSR (prerender=false). Protegge `/admin/*` verificando il cookie `admin_token`. Se scaduto, tenta il refresh chiamando `PATCH /api/admin/auth`. Se il refresh fallisce, redirect a `/admin/login`.

- [ ] **Step 1: Creare `src/middleware.ts`**

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context

  // Protegge solo le route /admin/* (non /admin/login e non le API)
  const isAdminRoute = url.pathname.startsWith('/admin')
  const isLoginPage = url.pathname === '/admin/login'
  const isApiRoute = url.pathname.startsWith('/api/')

  if (!isAdminRoute || isLoginPage || isApiRoute) {
    return next()
  }

  const token = cookies.get('admin_token')?.value
  const refreshToken = cookies.get('admin_refresh')?.value

  // Token presente → passa
  if (token) {
    return next()
  }

  // Token assente ma refresh presente → prova a rinnovare
  if (refreshToken) {
    const directusUrl = process.env.DIRECTUS_URL ?? ''
    const res = await fetch(`${directusUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
    }).catch(() => null)

    if (res?.ok) {
      const { data } = await res.json() as { data: { access_token: string; refresh_token: string } }
      const cookieOpts = {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax' as const,
        path: '/',
      }
      cookies.set('admin_token', data.access_token, { ...cookieOpts, maxAge: 900 })
      cookies.set('admin_refresh', data.refresh_token, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })
      return next()
    }
  }

  // Nessun token valido → redirect a login
  const redirectTo = encodeURIComponent(url.pathname + url.search)
  return redirect(`/admin/login?redirect=${redirectTo}`)
})
```

- [ ] **Step 2: Verificare che il file sia corretto**

```bash
npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 3: Test manuale — senza cookie, /admin deve redirigere a login**

```bash
npm run dev
```
Aprire http://localhost:4321/admin in una scheda in incognito (nessun cookie). Expected: redirect a `/admin/login`.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(admin): add middleware to protect /admin/* routes"
```

---

## Task 3: AdminLayout con sidebar a icone

**Files:**
- Create: `src/layouts/AdminLayout.astro`

> **Contesto:** Layout condiviso da tutte le pagine admin. Sidebar sinistra con icone SVG line (40px di larghezza compressa, 200px espansa), espandibile con click su un'icona hamburger. Lo stato espanso/compresso è salvato in `localStorage`. I 2 colori brand sono CSS custom properties lette da `site_settings` (fetched server-side). La sidebar ha 8 voci: Dashboard, Contatti, Ordini, Prodotti, Coupon, Gift Card, Spedizioni, Form, Pagine, Articoli, Impostazioni.

- [ ] **Step 1: Creare `src/layouts/AdminLayout.astro`**

```astro
---
// src/layouts/AdminLayout.astro
export const prerender = false

interface Props {
  title: string
  /** Voce attiva nella sidebar, es. "contacts" */
  active?: string
}

const { title, active } = Astro.props

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

// Carica colori brand da site_settings (fallback ai default se non trovati)
let primaryColor = '#111827'
let accentColor = '#6366f1'

if (directusUrl && token) {
  try {
    const res = await fetch(`${directusUrl}/items/site_settings?fields[]=primary_color&fields[]=accent_color`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const { data } = await res.json()
      if (data?.primary_color) primaryColor = data.primary_color
      if (data?.accent_color) accentColor = data.accent_color
    }
  } catch {}
}

const navItems = [
  { key: 'dashboard',    href: '/admin',                    label: 'Dashboard',    icon: 'grid' },
  { key: 'contacts',     href: '/admin/contacts',           label: 'Contatti',     icon: 'users' },
  { key: 'orders',       href: '/admin/orders',             label: 'Ordini',       icon: 'shopping-bag' },
  { key: 'products',     href: '/admin/products',           label: 'Prodotti',     icon: 'package' },
  { key: 'coupons',      href: '/admin/coupons',            label: 'Coupon',       icon: 'tag' },
  { key: 'gift-cards',   href: '/admin/gift-cards',         label: 'Gift Card',    icon: 'gift' },
  { key: 'shipping',     href: '/admin/shipping',           label: 'Spedizioni',   icon: 'truck' },
  { key: 'forms',        href: '/admin/forms',              label: 'Form',         icon: 'mail' },
  { key: 'pages',        href: '/admin/pages',              label: 'Pagine',       icon: 'file-text' },
  { key: 'articles',     href: '/admin/articles',           label: 'Articoli',     icon: 'edit' },
  { key: 'settings',     href: '/admin/settings',           label: 'Impostazioni', icon: 'settings' },
]

// SVG icons (line style)
const icons: Record<string, string> = {
  'grid':         `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
  'users':        `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  'shopping-bag': `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
  'package':      `<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
  'tag':          `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
  'gift':         `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
  'truck':        `<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
  'mail':         `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
  'file-text':    `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
  'edit':         `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`,
  'settings':     `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  'menu':         `<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>`,
  'log-out':      `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
}

function icon(name: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icons[name] ?? ''}</svg>`
}
---

<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — Admin</title>
  <style>
    :root {
      --admin-primary: {primaryColor};
      --admin-accent: {accentColor};
      --sidebar-width-collapsed: 56px;
      --sidebar-width-expanded: 200px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { display: flex; min-height: 100vh; background: #f9fafb; font-family: system-ui, sans-serif; color: #111827; }

    /* Sidebar */
    #admin-sidebar {
      width: var(--sidebar-width-collapsed);
      background: #fff;
      border-right: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width 0.2s ease;
      overflow: hidden;
      position: sticky;
      top: 0;
      height: 100vh;
    }
    #admin-sidebar.expanded { width: var(--sidebar-width-expanded); }

    .sidebar-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 52px;
      flex-shrink: 0;
      cursor: pointer;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }
    .sidebar-toggle:hover { color: #111827; background: #f9fafb; }

    .sidebar-nav { flex: 1; padding: 8px 0; overflow-y: auto; overflow-x: hidden; }

    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      height: 40px;
      color: #6b7280;
      text-decoration: none;
      white-space: nowrap;
      transition: color 0.15s, background 0.15s;
      font-size: 13px;
    }
    .sidebar-item:hover { color: #111827; background: #f9fafb; }
    .sidebar-item.active {
      color: var(--admin-primary);
      background: color-mix(in srgb, var(--admin-primary) 8%, transparent);
    }
    .sidebar-item .icon { flex-shrink: 0; width: 18px; }
    .sidebar-item .label { opacity: 0; transition: opacity 0.15s; }
    #admin-sidebar.expanded .sidebar-item .label { opacity: 1; }

    .sidebar-footer {
      border-top: 1px solid #e5e7eb;
      padding: 8px 0;
    }

    /* Main */
    #admin-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

    .admin-topbar {
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 0 24px;
      height: 52px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .admin-topbar h1 { font-size: 15px; font-weight: 600; }

    .admin-content { flex: 1; padding: 24px; overflow-x: hidden; }
  </style>
</head>
<body>

  <!-- Sidebar -->
  <aside id="admin-sidebar">
    <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Espandi/comprimi sidebar" type="button">
      <Fragment set:html={icon('menu')} />
    </button>

    <nav class="sidebar-nav">
      {navItems.map(item => (
        <a
          href={item.href}
          class:list={['sidebar-item', { active: active === item.key }]}
          title={item.label}
        >
          <span class="icon" set:html={icon(item.icon)} />
          <span class="label">{item.label}</span>
        </a>
      ))}
    </nav>

    <div class="sidebar-footer">
      <button
        id="admin-logout"
        type="button"
        class="sidebar-item"
        style="width:100%;border:none;background:none;cursor:pointer;text-align:left;"
        title="Esci"
      >
        <span class="icon" set:html={icon('log-out')} />
        <span class="label">Esci</span>
      </button>
    </div>
  </aside>

  <!-- Main content -->
  <div id="admin-main">
    <div class="admin-topbar">
      <h1>{title}</h1>
      <slot name="topbar-actions" />
    </div>
    <div class="admin-content">
      <slot />
    </div>
  </div>

</body>
</html>

<script>
  const sidebar = document.getElementById('admin-sidebar')!
  const toggle = document.getElementById('sidebar-toggle')!

  // Ripristina stato da localStorage
  if (localStorage.getItem('admin-sidebar-expanded') === 'true') {
    sidebar.classList.add('expanded')
  }

  toggle.addEventListener('click', () => {
    const expanded = sidebar.classList.toggle('expanded')
    localStorage.setItem('admin-sidebar-expanded', String(expanded))
  })

  document.getElementById('admin-logout')?.addEventListener('click', async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    window.location.href = '/admin/login'
  })
</script>
```

- [ ] **Step 2: Verificare che non ci siano errori TypeScript**

```bash
npx tsc --noEmit
```
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/AdminLayout.astro
git commit -m "feat(admin): add AdminLayout with collapsible icon sidebar"
```

---

## Task 4: DataTable component riutilizzabile

**Files:**
- Create: `src/components/admin/DataTable.astro`

> **Contesto:** Tabella generica usata da tutte le pagine lista (contatti, ordini, prodotti, ecc.). Supporta scroll orizzontale, colonne configurabili con formatter, link per il dettaglio. Paginazione server-side via query param `?page=`.

- [ ] **Step 1: Creare `src/components/admin/DataTable.astro`**

```astro
---
// src/components/admin/DataTable.astro

export interface Column {
  key: string
  label: string
  /** Funzione per formattare il valore della cella. Ritorna stringa HTML. */
  format?: (value: unknown, row: Record<string, unknown>) => string
  /** Classe CSS aggiuntiva per la cella */
  class?: string
}

interface Props {
  columns: Column[]
  rows: Record<string, unknown>[]
  /** Campo da usare come ID per il link di dettaglio */
  idField?: string
  /** Base URL per il link di dettaglio, es. "/admin/contacts/" */
  detailBase?: string
  /** Pagina corrente (1-indexed) */
  page?: number
  /** Totale record per paginazione */
  total?: number
  /** Record per pagina */
  pageSize?: number
  /** Messaggio se nessun risultato */
  emptyMessage?: string
}

const {
  columns,
  rows,
  idField = 'id',
  detailBase,
  page = 1,
  total = 0,
  pageSize = 25,
  emptyMessage = 'Nessun risultato.',
} = Astro.props

const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1
const hasPrev = page > 1
const hasNext = page < totalPages

function buildPageUrl(p: number) {
  const url = new URL(Astro.request.url)
  url.searchParams.set('page', String(p))
  return url.pathname + url.search
}
---

<div class="data-table-wrapper">
  <div class="data-table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          {columns.map(col => (
            <th class={col.class}>{col.label}</th>
          ))}
          {detailBase && <th class="col-action"></th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? (
            <tr>
              <td colspan={columns.length + (detailBase ? 1 : 0)} class="empty-cell">
                {emptyMessage}
              </td>
            </tr>
          )
          : rows.map(row => (
            <tr>
              {columns.map(col => (
                <td
                  class={col.class}
                  set:html={col.format
                    ? col.format(row[col.key], row)
                    : String(row[col.key] ?? '—')}
                />
              ))}
              {detailBase && (
                <td class="col-action">
                  <a href={`${detailBase}${row[idField]}`} class="row-link">→</a>
                </td>
              )}
            </tr>
          ))
        }
      </tbody>
    </table>
  </div>

  {totalPages > 1 && (
    <div class="pagination">
      {hasPrev
        ? <a href={buildPageUrl(page - 1)} class="page-btn">← Prec</a>
        : <span class="page-btn disabled">← Prec</span>
      }
      <span class="page-info">Pagina {page} di {totalPages}</span>
      {hasNext
        ? <a href={buildPageUrl(page + 1)} class="page-btn">Succ →</a>
        : <span class="page-btn disabled">Succ →</span>
      }
    </div>
  )}
</div>

<style>
  .data-table-wrapper { display: flex; flex-direction: column; gap: 0; }

  .data-table-scroll {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    white-space: nowrap;
  }

  .data-table thead th {
    text-align: left;
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .data-table tbody td {
    padding: 10px 16px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    background: #fff;
  }

  .data-table tbody tr:last-child td { border-bottom: none; }
  .data-table tbody tr:hover td { background: #f9fafb; }

  .col-action { width: 40px; text-align: center; }
  .row-link { color: #9ca3af; text-decoration: none; font-size: 16px; }
  .row-link:hover { color: #111827; }

  .empty-cell { text-align: center; color: #9ca3af; padding: 32px 16px; }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 0 0;
    font-size: 13px;
  }

  .page-btn {
    padding: 6px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    text-decoration: none;
    color: #374151;
    background: #fff;
  }
  .page-btn:hover { background: #f9fafb; }
  .page-btn.disabled { color: #d1d5db; cursor: default; }
  .page-info { color: #6b7280; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/DataTable.astro
git commit -m "feat(admin): add reusable DataTable component with horizontal scroll"
```

---

## Task 5: Aggiornare login page con email+password

**Files:**
- Modify: `src/pages/admin/login.astro`

> **Contesto:** L'attuale login chiede solo password (ADMIN_KEY). Lo sostituiamo con email + password che vanno a Directus. Usiamo AdminLayout? No — la login page non ha sidebar, ha il suo layout minimale standalone. Rimuoviamo Header/Footer del sito pubblico.

- [ ] **Step 1: Sostituire `src/pages/admin/login.astro`**

```astro
---
// src/pages/admin/login.astro
export const prerender = false

// Se già autenticato, redirect a /admin
const token = Astro.cookies.get('admin_token')?.value
if (token) {
  const redirectTo = Astro.url.searchParams.get('redirect') ?? '/admin'
  return Astro.redirect(redirectTo)
}

const redirectTo = Astro.url.searchParams.get('redirect') ?? '/admin'
---

<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accesso Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      font-family: system-ui, sans-serif;
    }
    .card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 360px;
    }
    h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
    input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      color: #111827;
      background: #fff;
      outline: none;
    }
    input:focus { border-color: #111827; box-shadow: 0 0 0 2px rgba(17,24,39,0.1); }
    .field { margin-bottom: 16px; }
    .error { display: none; font-size: 13px; color: #dc2626; margin-bottom: 12px; }
    .error.visible { display: block; }
    button[type=submit] {
      width: 100%;
      padding: 10px;
      background: #111827;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 8px;
    }
    button[type=submit]:hover { background: #1f2937; }
    button[type=submit]:disabled { opacity: 0.6; cursor: default; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Accesso admin</h1>
    <form id="login-form">
      <input type="hidden" name="redirect" value={redirectTo} />
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" required autocomplete="email" placeholder="admin@esempio.it" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" type="password" required autocomplete="current-password" />
      </div>
      <p id="error" class="error"></p>
      <button type="submit" id="submit-btn">Accedi</button>
    </form>
  </div>
</body>
</html>

<script>
  const form = document.getElementById('login-form') as HTMLFormElement
  const errorEl = document.getElementById('error')!
  const btn = document.getElementById('submit-btn') as HTMLButtonElement

  form.addEventListener('submit', async e => {
    e.preventDefault()
    errorEl.classList.remove('visible')
    btn.disabled = true
    btn.textContent = 'Accesso in corso…'

    const email = (document.getElementById('email') as HTMLInputElement).value
    const password = (document.getElementById('password') as HTMLInputElement).value
    const redirect = form.querySelector<HTMLInputElement>('[name=redirect]')?.value ?? '/admin'

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        window.location.href = redirect
      } else {
        const data = await res.json()
        errorEl.textContent = data.error ?? 'Credenziali non valide.'
        errorEl.classList.add('visible')
        btn.disabled = false
        btn.textContent = 'Accedi'
      }
    } catch {
      errorEl.textContent = 'Errore di rete. Riprova.'
      errorEl.classList.add('visible')
      btn.disabled = false
      btn.textContent = 'Accedi'
    }
  })
</script>
```

- [ ] **Step 2: Test manuale — flusso login completo**

```bash
npm run dev
```
1. Aprire http://localhost:4321/admin in incognito → redirect a `/admin/login`
2. Inserire email+password di un utente Directus con ruolo Staff → click Accedi
3. Expected: redirect a `/admin`
4. Inserire credenziali errate → Expected: messaggio "Credenziali non valide."

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/login.astro
git commit -m "feat(admin): update login page to use email+password Directus auth"
```

---

## Task 6: Aggiornare Dashboard con AdminLayout

**Files:**
- Modify: `src/pages/admin/index.astro`

> **Contesto:** La dashboard esistente funziona bene ma usa `Base.astro` (layout pubblico con Header/Footer) e controlla `ADMIN_KEY`. La aggiorniamo per usare `AdminLayout`, rimuoviamo il check ADMIN_KEY (ci pensa il middleware), e usiamo il token Directus dal cookie per le chiamate API. I dati KPI e la logica rimangono invariati.

- [ ] **Step 1: Sostituire l'intestazione della dashboard**

Nel file `src/pages/admin/index.astro`, sostituire le righe 1–13 (dal commento all'import) con:

```astro
---
// src/pages/admin/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'

const directusUrl = process.env.DIRECTUS_URL ?? ''
const directusToken = Astro.cookies.get('admin_token')?.value ?? ''
```

- [ ] **Step 2: Aggiornare la funzione `dFetch` per usare il token dal cookie**

Sostituire la funzione `dFetch` esistente (che usa `DIRECTUS_TOKEN` env) con:

```typescript
async function dFetch(path: string) {
  const res = await fetch(`${directusUrl}${path}`, {
    headers: { Authorization: `Bearer ${directusToken}` },
  })
  if (!res.ok) return null
  return res.json()
}
```

- [ ] **Step 3: Sostituire il wrapper HTML con AdminLayout**

Sostituire `<Base title="Admin Dashboard">` / `<Header />` / `<main class="container py-10">` con:

```astro
<AdminLayout title="Dashboard" active="dashboard">
```

Sostituire `</main>` / `<Footer />` / `</Base>` (alla fine) con:

```astro
</AdminLayout>
```

Rimuovere il tag `<div class="flex items-center justify-between mb-8 flex-wrap gap-4">` con il titolo e il pulsante logout (ora è nella sidebar).

- [ ] **Step 4: Aggiornare il link "Vedi tutti →" per puntare al pannello interno**

Cercare:
```astro
<a href={`${directusUrl}/admin/content/orders`} target="_blank" rel="noopener" ...>Vedi tutti →</a>
```

Sostituire con:
```astro
<a href="/admin/orders" class="text-xs text-gray-400 hover:text-gray-700">Vedi tutti →</a>
```

- [ ] **Step 5: Verificare visivamente**

```bash
npm run dev
```
1. Login con credenziali Directus → Expected: dashboard con sidebar a sinistra
2. Clicca icona hamburger → Expected: sidebar si espande mostrando le label
3. Voce "Dashboard" in sidebar deve essere evidenziata

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat(admin): migrate dashboard to AdminLayout, use JWT token for API calls"
```

---

## Task 7: Sincronizzare ottica-marangon

> **Contesto:** Tutti i file modificati/creati nel template devono essere copiati nel repo ottica-marangon. Il template è la fonte di verità.

- [ ] **Step 1: Copiare i file nel repo ottica-marangon**

```bash
TEMPLATE="/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
TARGET="/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"

cp "$TEMPLATE/src/middleware.ts" "$TARGET/src/middleware.ts"
cp "$TEMPLATE/src/layouts/AdminLayout.astro" "$TARGET/src/layouts/AdminLayout.astro"
cp "$TEMPLATE/src/components/admin/DataTable.astro" "$TARGET/src/components/admin/DataTable.astro"
cp "$TEMPLATE/src/pages/api/admin/auth.ts" "$TARGET/src/pages/api/admin/auth.ts"
cp "$TEMPLATE/src/pages/admin/login.astro" "$TARGET/src/pages/admin/login.astro"
cp "$TEMPLATE/src/pages/admin/index.astro" "$TARGET/src/pages/admin/index.astro"
```

- [ ] **Step 2: Verificare che la cartella components/admin esista nel target**

```bash
mkdir -p "$TARGET/src/components/admin"
```

- [ ] **Step 3: Commit nel repo ottica-marangon**

```bash
cd "/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"
git add src/middleware.ts src/layouts/AdminLayout.astro src/components/admin/DataTable.astro src/pages/api/admin/auth.ts src/pages/admin/login.astro src/pages/admin/index.astro
git commit -m "feat(admin): sync foundation from template — JWT auth, middleware, AdminLayout, DataTable"
```

---

## Checklist finale Piano 1

- [ ] `POST /api/admin/auth` con email+password funziona → imposta cookie `admin_token` + `admin_refresh`
- [ ] `DELETE /api/admin/auth` funziona → rimuove i cookie, redirect a login
- [ ] `PATCH /api/admin/auth` funziona → rinnova i cookie
- [ ] `/admin/qualsiasi-route` senza cookie → redirect a `/admin/login?redirect=...`
- [ ] `/admin/login` con cookie valido → redirect a `/admin` (o redirect param)
- [ ] Sidebar si espande/comprime → stato persiste in localStorage
- [ ] Dashboard carica KPI da Directus con token JWT dal cookie
- [ ] Entrambi i repo sono sincronizzati e committati
