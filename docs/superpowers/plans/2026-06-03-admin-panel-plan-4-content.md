# Admin Panel — Piano 4: Content & Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare le pagine Content del pannello admin: form management, articoli, page builder con block editor dinamico, e impostazioni sito con color picker.

**Architecture:** Astro SSR, pure CSS, vanilla JS per le interazioni client-side (dialog HTML5, fetch API). Nessun Preact (non installato). Il block editor usa `<dialog>` native + fetch dinamica dei campi Directus da `/fields/{block_type}`. Le impostazioni usano `input[type=color]` con live preview via CSS custom properties.

**Tech Stack:** Astro SSR, DataTable, SectionCard, AdminLayout (tutti già implementati), Directus REST API

**Spec di riferimento:** `docs/superpowers/specs/2026-06-02-admin-panel-design.md`

---

## File Structure

```
src/
  pages/
    admin/
      forms/
        index.astro          ← NUOVO: lista form
        [id].astro           ← NUOVO: info form + submissions
      articles/
        index.astro          ← NUOVO: lista articoli
        [id].astro           ← NUOVO: form articolo (titolo, body, SEO, stato)
      pages/
        index.astro          ← NUOVO: lista pagine CMS
        [id].astro           ← NUOVO: metadata + block editor
      settings/
        index.astro          ← NUOVO: impostazioni sito + color picker
```

---

## Task 1: Forms list + detail

**Files:**
- Create: `src/pages/admin/forms/index.astro`
- Create: `src/pages/admin/forms/[id].astro`

> **Contesto:** Lista form con nome, n. campi, n. submissions. Dettaglio: configurazione form (read-only) + tabella submissions collegate.

- [ ] **Step 1: Creare `src/pages/admin/forms/index.astro`**

```astro
---
// src/pages/admin/forms/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { Form } from '@/lib/types'

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

const PAGE_SIZE = 25
const page = Math.max(1, parseInt(Astro.url.searchParams.get('page') ?? '1'))
const offset = (page - 1) * PAGE_SIZE

const [listRes, countRes] = await Promise.all([
  dFetch(`/items/forms?fields[]=id,name,slug,fields,is_active&sort[]=name&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/forms?aggregate[count]=id'),
])

type FormRow = Pick<Form, 'id' | 'name' | 'slug' | 'is_active'> & {
  fields: unknown[] | null
}

const forms = (listRes?.data ?? []) as FormRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  { key: 'name', label: 'Nome', format: (v) => `<span style="font-weight:500;color:#111827">${String(v ?? '—')}</span>` },
  { key: 'slug', label: 'Slug', format: (v) => `<span style="font-family:monospace;font-size:12px;color:#6b7280">${String(v ?? '—')}</span>` },
  {
    key: 'fields',
    label: 'Campi',
    format: (v) => {
      const fields = v as unknown[] | null
      return `<span style="color:#6b7280">${fields?.length ?? 0}</span>`
    },
  },
  {
    key: 'is_active',
    label: 'Stato',
    format: (v) => v
      ? `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Attivo</span>`
      : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:12px">Inattivo</span>`,
  },
]
---

<AdminLayout title="Form" active="forms">
  <DataTable
    columns={columns}
    rows={forms as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/forms/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessun form trovato."
  />
</AdminLayout>
```

- [ ] **Step 2: Creare `src/pages/admin/forms/[id].astro`**

```astro
---
// src/pages/admin/forms/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { Form, FormSubmission } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/forms')

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

const SUB_PAGE_SIZE = 25
const subPage = Math.max(1, parseInt(Astro.url.searchParams.get('page') ?? '1'))
const subOffset = (subPage - 1) * SUB_PAGE_SIZE

const [formRes, subsRes, subCountRes] = await Promise.all([
  dFetch(`/items/forms/${id}?fields[]=*`),
  dFetch(`/items/form_submissions?filter[form_id][_eq]=${id}&fields[]=id,data,date_created,is_read&sort[]=-date_created&limit=${SUB_PAGE_SIZE}&offset=${subOffset}`),
  dFetch(`/items/form_submissions?filter[form_id][_eq]=${id}&aggregate[count]=id`),
])

if (!formRes?.data) return Astro.redirect('/admin/forms')

const form = formRes.data as Form
const submissions = (subsRes?.data ?? []) as Partial<FormSubmission>[]
const subTotal = parseInt(subCountRes?.data?.[0]?.count?.id ?? '0')

function extractPreview(data: Record<string, unknown>): string {
  const val = Object.values(data)[0]
  const str = String(val ?? '')
  return str.length > 60 ? str.slice(0, 60) + '…' : str || '—'
}

const subColumns: Column[] = [
  {
    key: 'data',
    label: 'Anteprima',
    format: (v) => `<span style="color:#374151;font-size:13px">${extractPreview(v as Record<string, unknown>)}</span>`,
  },
  {
    key: 'date_created',
    label: 'Data',
    format: (v) => v ? new Date(String(v)).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—',
  },
  {
    key: 'is_read',
    label: 'Stato',
    format: (v) => v
      ? `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Letto</span>`
      : `<span style="background:#fef9c3;color:#ca8a04;padding:2px 8px;border-radius:10px;font-size:12px">Nuovo</span>`,
  },
]
---

<AdminLayout title={form.name} active="forms">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/forms" style="color:#6b7280;text-decoration:none;font-size:13px">← Form</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">{form.name}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${
      form.is_active ? 'background:#f0fdf4;color:#22c55e' : 'background:#f3f4f6;color:#6b7280'
    }`}>{form.is_active ? 'Attivo' : 'Inattivo'}</span>
  </div>

  <div style="display:flex;flex-direction:column;gap:16px">

    <SectionCard title="Configurazione">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px">
        <div><span style="color:#6b7280">Slug:</span> <code style="font-size:12px">{form.slug}</code></div>
        <div><span style="color:#6b7280">Campi:</span> {form.fields?.length ?? 0}</div>
        <div><span style="color:#6b7280">Notifica email:</span> {form.notification_email ?? '—'}</div>
        <div><span style="color:#6b7280">Redirect:</span> {form.redirect_enabled ? (form.redirect_url ?? '—') : 'No'}</div>
        <div><span style="color:#6b7280">reCAPTCHA:</span> {form.recaptcha_enabled ? 'Sì' : 'No'}</div>
        <div><span style="color:#6b7280">Honeypot:</span> {form.honeypot_enabled ? 'Sì' : 'No'}</div>
      </div>
    </SectionCard>

    {form.fields && form.fields.length > 0 && (
      <SectionCard title="Campi form">
        <div style="display:flex;flex-direction:column;gap:6px">
          {form.fields.map((f) => (
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px">
              <span style="font-family:monospace;color:#6b7280;font-size:12px;min-width:120px">{f.name}</span>
              <span style="color:#374151;font-weight:500">{f.label}</span>
              <span style="background:#f3f4f6;color:#6b7280;padding:1px 6px;border-radius:4px;font-size:11px">{f.type}</span>
              {f.required && <span style="color:#dc2626;font-size:11px">*</span>}
            </div>
          ))}
        </div>
      </SectionCard>
    )}

    <SectionCard title={`Submissions (${subTotal})`}>
      <DataTable
        columns={subColumns}
        rows={submissions as unknown as Record<string, unknown>[]}
        idField="id"
        detailBase="/admin/contact-submissions/"
        page={subPage}
        total={subTotal}
        pageSize={SUB_PAGE_SIZE}
        emptyMessage="Nessuna submission."
      />
    </SectionCard>

  </div>
</AdminLayout>
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add src/pages/admin/forms/
git commit -m "feat(admin): add forms list and detail with submissions"
```

---

## Task 2: Articles list + detail form

**Files:**
- Create: `src/pages/admin/articles/index.astro`
- Create: `src/pages/admin/articles/[id].astro`

> **Contesto:** Lista articoli (Post). Dettaglio con form editabile: titolo, body (textarea HTML), excerpt, SEO, stato, data pubblicazione. Il Tiptap editor non è installato — usiamo una textarea con note che il campo body accetta HTML.

- [ ] **Step 1: Creare `src/pages/admin/articles/index.astro`**

```astro
---
// src/pages/admin/articles/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { Post } from '@/lib/types'

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

const PAGE_SIZE = 25
const page = Math.max(1, parseInt(Astro.url.searchParams.get('page') ?? '1'))
const offset = (page - 1) * PAGE_SIZE

const [listRes, countRes] = await Promise.all([
  dFetch(`/items/posts?fields[]=id,title,slug,status,published_at,category.name&sort[]=-published_at&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/posts?aggregate[count]=id'),
])

type ArticleRow = Pick<Post, 'id' | 'title' | 'slug' | 'status' | 'published_at'> & {
  category: { name: string } | null
}

const articles = (listRes?.data ?? []) as ArticleRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  { key: 'title', label: 'Titolo', format: (v) => `<span style="font-weight:500;color:#111827">${String(v ?? '—')}</span>` },
  {
    key: 'category',
    label: 'Categoria',
    format: (v) => {
      const cat = v as { name: string } | null
      return `<span style="color:#6b7280;font-size:13px">${cat?.name ?? '—'}</span>`
    },
  },
  {
    key: 'status',
    label: 'Stato',
    format: (v) => v === 'published'
      ? `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Pubblicato</span>`
      : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:12px">Bozza</span>`,
  },
  {
    key: 'published_at',
    label: 'Pubblicato',
    format: (v) => v ? new Date(String(v)).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—',
  },
]
---

<AdminLayout title="Articoli" active="articles">
  <DataTable
    columns={columns}
    rows={articles as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/articles/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessun articolo trovato."
  />
</AdminLayout>
```

- [ ] **Step 2: Creare `src/pages/admin/articles/[id].astro`**

```astro
---
// src/pages/admin/articles/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { Post } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/articles')

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...((opts?.headers as Record<string, string>) ?? {}) },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

let saveError: string | null = null

if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData()
  const payload = {
    title: formData.get('title'),
    slug: formData.get('slug'),
    content: formData.get('content') || null,
    excerpt: formData.get('excerpt') || null,
    status: formData.get('status'),
    seo_title: formData.get('seo_title') || null,
    seo_description: formData.get('seo_description') || null,
    published_at: formData.get('published_at') || null,
  }
  const result = await dFetch(`/items/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (result) {
    return Astro.redirect(`/admin/articles/${id}?saved=1`)
  } else {
    saveError = 'Errore durante il salvataggio.'
  }
}

const articleRes = await dFetch(`/items/posts/${id}?fields[]=*`)
if (!articleRes?.data) return Astro.redirect('/admin/articles')

const article = articleRes.data as Post
const saved = Astro.url.searchParams.get('saved') === '1'

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}
---

<AdminLayout title={article.title} active="articles">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/articles" style="color:#6b7280;text-decoration:none;font-size:13px">← Articoli</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">{article.title}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${
      article.status === 'published' ? 'background:#f0fdf4;color:#22c55e' : 'background:#f3f4f6;color:#6b7280'
    }`}>{article.status === 'published' ? 'Pubblicato' : 'Bozza'}</span>
  </div>

  {saved && <p style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">✓ Salvato con successo.</p>}
  {saveError && <p style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">{saveError}</p>}

  <form method="POST">
    <div style="display:flex;flex-direction:column;gap:16px">

      <SectionCard title="Contenuto">
        <div style="display:flex;flex-direction:column;gap:14px">

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Titolo *</label>
            <input name="title" required value={article.title}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Slug *</label>
            <input name="slug" required value={article.slug}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;font-family:monospace;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">
              Body <span style="color:#9ca3af;font-weight:400;font-size:12px">(HTML accettato)</span>
            </label>
            <textarea name="content" rows={16}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:13px;font-family:monospace;color:#111827;box-sizing:border-box;resize:vertical;line-height:1.5">{article.content ?? ''}</textarea>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Excerpt</label>
            <textarea name="excerpt" rows={3}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;resize:vertical">{article.excerpt ?? ''}</textarea>
          </div>

        </div>
      </SectionCard>

      <SectionCard title="Pubblicazione">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Stato</label>
            <select name="status"
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;background:#fff;box-sizing:border-box">
              <option value="published" selected={article.status === 'published'}>Pubblicato</option>
              <option value="draft" selected={article.status === 'draft'}>Bozza</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Data pubblicazione</label>
            <input name="published_at" type="datetime-local" value={toDatetimeLocal(article.published_at)}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

        </div>
      </SectionCard>

      <SectionCard title="SEO">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">SEO Title</label>
            <input name="seo_title" value={article.seo_title ?? ''}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">SEO Description</label>
            <textarea name="seo_description" rows={2}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;resize:vertical">{article.seo_description ?? ''}</textarea>
          </div>
        </div>
      </SectionCard>

      <div style="display:flex;justify-content:flex-end">
        <button type="submit"
          style="background:#111827;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer">
          Salva
        </button>
      </div>

    </div>
  </form>

</AdminLayout>
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add src/pages/admin/articles/
git commit -m "feat(admin): add articles list and detail form"
```

---

## Task 3: Pages list + page editor (block editor)

**Files:**
- Create: `src/pages/admin/pages/index.astro`
- Create: `src/pages/admin/pages/[id].astro`

> **Contesto:** Lista pagine CMS. Dettaglio: layout a due colonne. Sinistra: form metadata (slug, SEO, status) con server-side POST. Destra: lista blocchi dalla junction `pages_blocks`, con pulsanti Edit/Delete per ogni blocco. Edit apre una `<dialog>` HTML5 che carica i campi Directus via fetch e renderizza un form dinamico. Salva via PATCH su Directus.

- [ ] **Step 1: Creare `src/pages/admin/pages/index.astro`**

```astro
---
// src/pages/admin/pages/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { Page } from '@/lib/types'

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

const PAGE_SIZE = 25
const page = Math.max(1, parseInt(Astro.url.searchParams.get('page') ?? '1'))
const offset = (page - 1) * PAGE_SIZE

const [listRes, countRes] = await Promise.all([
  dFetch(`/items/pages?fields[]=id,title,slug,status&sort[]=title&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/pages?aggregate[count]=id'),
])

type PageRow = Pick<Page, 'id' | 'title' | 'slug' | 'status'>

const pages = (listRes?.data ?? []) as PageRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  { key: 'title', label: 'Titolo', format: (v) => `<span style="font-weight:500;color:#111827">${String(v ?? '—')}</span>` },
  { key: 'slug', label: 'Slug', format: (v) => `<span style="font-family:monospace;font-size:12px;color:#6b7280">${String(v ?? '—')}</span>` },
  {
    key: 'status',
    label: 'Stato',
    format: (v) => v === 'published'
      ? `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Pubblicata</span>`
      : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:12px">Bozza</span>`,
  },
]
---

<AdminLayout title="Pagine" active="pages">
  <DataTable
    columns={columns}
    rows={pages as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/pages/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessuna pagina trovata."
  />
</AdminLayout>
```

- [ ] **Step 2: Creare `src/pages/admin/pages/[id].astro`**

```astro
---
// src/pages/admin/pages/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { Page } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/pages')

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...((opts?.headers as Record<string, string>) ?? {}) },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

let saveError: string | null = null

// Server-side: salva solo i metadata della pagina
if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData()
  const payload = {
    title: formData.get('title'),
    slug: formData.get('slug'),
    status: formData.get('status'),
    seo_title: formData.get('seo_title') || null,
    seo_description: formData.get('seo_description') || null,
  }
  const result = await dFetch(`/items/pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (result) {
    return Astro.redirect(`/admin/pages/${id}?saved=1`)
  } else {
    saveError = 'Errore durante il salvataggio.'
  }
}

// Fetch pagina + blocchi dalla junction pages_blocks
const [pageRes, blocksRes] = await Promise.all([
  dFetch(`/items/pages/${id}?fields[]=id,title,slug,status,seo_title,seo_description`),
  dFetch(`/items/pages_blocks?filter[page_id][_eq]=${id}&fields[]=id,block_type,block_id,sort&sort[]=sort`),
])

if (!pageRes?.data) return Astro.redirect('/admin/pages')

const page = pageRes.data as Page
const blocks = (blocksRes?.data ?? []) as Array<{
  id: string
  block_type: string
  block_id: string
  sort: number
}>

const saved = Astro.url.searchParams.get('saved') === '1'
---

<AdminLayout title={page.title} active="pages">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/pages" style="color:#6b7280;text-decoration:none;font-size:13px">← Pagine</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">{page.title}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${
      page.status === 'published' ? 'background:#f0fdf4;color:#22c55e' : 'background:#f3f4f6;color:#6b7280'
    }`}>{page.status === 'published' ? 'Pubblicata' : 'Bozza'}</span>
  </div>

  {saved && <p style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">✓ Salvato con successo.</p>}
  {saveError && <p style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">{saveError}</p>}

  <!-- Layout 2 colonne: metadata | blocchi -->
  <div style="display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:start">

    <!-- Colonna sinistra: metadata -->
    <form method="POST">
      <div style="display:flex;flex-direction:column;gap:16px">

        <SectionCard title="Info pagina">
          <div style="display:flex;flex-direction:column;gap:12px">

            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Titolo *</label>
              <input name="title" required value={page.title}
                style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
            </div>

            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Slug *</label>
              <input name="slug" required value={page.slug}
                style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;font-family:monospace;color:#111827;box-sizing:border-box" />
            </div>

            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Stato</label>
              <select name="status"
                style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;background:#fff;box-sizing:border-box">
                <option value="published" selected={page.status === 'published'}>Pubblicata</option>
                <option value="draft" selected={page.status === 'draft'}>Bozza</option>
              </select>
            </div>

            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">SEO Title</label>
              <input name="seo_title" value={page.seo_title ?? ''}
                style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
            </div>

            <div>
              <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">SEO Description</label>
              <textarea name="seo_description" rows={3}
                style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;resize:vertical">{page.seo_description ?? ''}</textarea>
            </div>

          </div>
        </SectionCard>

        <button type="submit"
          style="background:#111827;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;width:100%">
          Salva metadata
        </button>

      </div>
    </form>

    <!-- Colonna destra: block editor -->
    <div>
      <SectionCard title={`Sezioni (${blocks.length})`}>
        <div id="blocks-list" style="display:flex;flex-direction:column;gap:8px">
          {blocks.length === 0
            ? <p style="color:#9ca3af;font-size:14px;margin:0">Nessuna sezione. Clicca "Aggiungi sezione" per iniziare.</p>
            : blocks.map(b => (
              <div
                class="block-row"
                data-junction-id={b.id}
                data-block-type={b.block_type}
                data-block-id={b.block_id}
                style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:6px"
              >
                <span style="color:#9ca3af;cursor:grab;font-size:16px">⠿</span>
                <div style="flex:1">
                  <span style="font-size:13px;font-weight:500;color:#374151">{b.block_type.replace('block_', '').replace(/_/g, ' ')}</span>
                  <span style="font-size:12px;color:#9ca3af;margin-left:8px">ID {b.block_id}</span>
                </div>
                <button
                  type="button"
                  class="edit-block-btn"
                  data-block-type={b.block_type}
                  data-block-id={b.block_id}
                  style="border:1px solid #e5e7eb;background:#fff;padding:4px 10px;border-radius:4px;font-size:12px;cursor:pointer;color:#374151"
                >
                  ✏ Modifica
                </button>
                <button
                  type="button"
                  class="delete-block-btn"
                  data-junction-id={b.id}
                  style="border:none;background:none;padding:4px 8px;font-size:12px;cursor:pointer;color:#9ca3af"
                >
                  ✕
                </button>
              </div>
            ))
          }
        </div>
        <div style="margin-top:12px">
          <button
            id="add-block-btn"
            type="button"
            style="width:100%;border:1px dashed #d1d5db;background:#fafafa;padding:10px;border-radius:6px;font-size:13px;color:#6b7280;cursor:pointer"
          >
            + Aggiungi sezione
          </button>
        </div>
      </SectionCard>
    </div>

  </div>

</AdminLayout>

<!-- Dialog per editing blocco (dinamica) -->
<dialog id="block-edit-dialog" style="border:none;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.15);padding:0;max-width:560px;width:90vw;max-height:80vh;overflow:hidden">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e5e7eb;background:#f9fafb">
    <span id="dialog-title" style="font-size:14px;font-weight:600;color:#111827;text-transform:capitalize"></span>
    <button id="dialog-close" type="button" style="border:none;background:none;font-size:18px;cursor:pointer;color:#6b7280;line-height:1">×</button>
  </div>
  <div id="dialog-body" style="padding:20px;overflow-y:auto;max-height:calc(80vh - 120px)">
    <p style="color:#9ca3af;font-size:14px">Caricamento campi…</p>
  </div>
  <div style="padding:14px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:10px">
    <button id="dialog-cancel" type="button"
      style="border:1px solid #e5e7eb;background:#fff;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;color:#374151">
      Annulla
    </button>
    <button id="dialog-save" type="button"
      style="background:#111827;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer">
      Salva
    </button>
  </div>
</dialog>

<!-- Dialog per aggiungere blocco -->
<dialog id="add-block-dialog" style="border:none;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.15);padding:0;max-width:480px;width:90vw">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e5e7eb;background:#f9fafb">
    <span style="font-size:14px;font-weight:600;color:#111827">Aggiungi sezione</span>
    <button id="add-dialog-close" type="button" style="border:none;background:none;font-size:18px;cursor:pointer;color:#6b7280;line-height:1">×</button>
  </div>
  <div id="add-dialog-body" style="padding:20px">
    <p style="color:#9ca3af;font-size:14px">Caricamento tipi disponibili…</p>
  </div>
  <div style="padding:14px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end">
    <button id="add-dialog-cancel" type="button"
      style="border:1px solid #e5e7eb;background:#fff;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;color:#374151">
      Annulla
    </button>
  </div>
</dialog>

<script define:vars={{ pageId: id, directusUrl, token }}>
  const editDialog = document.getElementById('block-edit-dialog')
  const dialogTitle = document.getElementById('dialog-title')
  const dialogBody = document.getElementById('dialog-body')
  const dialogSave = document.getElementById('dialog-save')
  const dialogClose = document.getElementById('dialog-close')
  const dialogCancel = document.getElementById('dialog-cancel')

  let currentBlockType = ''
  let currentBlockId = ''

  // Tipi di campi da ignorare (system fields)
  const SKIP_FIELDS = ['id', 'date_created', 'date_updated', 'user_created', 'user_updated']

  function buildInput(field, value) {
    const label = `<label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">${field.field}${field.schema?.is_nullable === false ? ' *' : ''}</label>`
    const inputStyle = 'width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box'
    const val = value ?? ''

    if (field.meta?.interface === 'select-dropdown' && field.meta?.options?.choices) {
      const options = field.meta.options.choices.map(c =>
        `<option value="${c.value}" ${val === c.value ? 'selected' : ''}>${c.text}</option>`
      ).join('')
      return `<div style="margin-bottom:14px">${label}<select name="${field.field}" style="${inputStyle};background:#fff">${options}</select></div>`
    }

    if (field.type === 'boolean') {
      return `<div style="margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" name="${field.field}" id="f_${field.field}" ${val ? 'checked' : ''} style="width:16px;height:16px">
        <label for="f_${field.field}" style="font-size:13px;font-weight:500;color:#374151">${field.field}</label>
      </div>`
    }

    if (field.type === 'text' || (field.meta?.interface === 'input-multiline')) {
      return `<div style="margin-bottom:14px">${label}<textarea name="${field.field}" rows="4" style="${inputStyle};resize:vertical">${val}</textarea></div>`
    }

    if (field.type === 'integer' || field.type === 'float' || field.type === 'decimal') {
      return `<div style="margin-bottom:14px">${label}<input type="number" name="${field.field}" value="${val}" style="${inputStyle}"></div>`
    }

    if (field.type === 'timestamp' || field.type === 'dateTime') {
      const dtVal = val ? new Date(val).toISOString().slice(0, 16) : ''
      return `<div style="margin-bottom:14px">${label}<input type="datetime-local" name="${field.field}" value="${dtVal}" style="${inputStyle}"></div>`
    }

    return `<div style="margin-bottom:14px">${label}<input type="text" name="${field.field}" value="${String(val)}" style="${inputStyle}"></div>`
  }

  async function openEditDialog(blockType, blockId) {
    currentBlockType = blockType
    currentBlockId = blockId
    dialogTitle.textContent = blockType.replace('block_', '').replace(/_/g, ' ')
    dialogBody.innerHTML = '<p style="color:#9ca3af;font-size:14px">Caricamento campi…</p>'
    editDialog.showModal()

    try {
      const [fieldsRes, dataRes] = await Promise.all([
        fetch(`${directusUrl}/fields/${blockType}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${directusUrl}/items/${blockType}/${blockId}?fields[]=*`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const { data: fields } = await fieldsRes.json()
      const { data: blockData } = await dataRes.json()

      const visibleFields = fields.filter(f => !SKIP_FIELDS.includes(f.field) && f.meta?.hidden !== true)

      if (!visibleFields.length) {
        dialogBody.innerHTML = '<p style="color:#9ca3af;font-size:14px">Nessun campo modificabile.</p>'
        return
      }

      dialogBody.innerHTML = visibleFields.map(f => buildInput(f, blockData[f.field])).join('')
    } catch (e) {
      dialogBody.innerHTML = '<p style="color:#dc2626;font-size:14px">Errore caricamento campi.</p>'
    }
  }

  async function saveBlock() {
    const inputs = dialogBody.querySelectorAll('input, textarea, select')
    const payload = {}
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        payload[input.name] = input.checked
      } else {
        payload[input.name] = input.value || null
      }
    })

    dialogSave.disabled = true
    dialogSave.textContent = 'Salvataggio…'

    try {
      const res = await fetch(`${directusUrl}/items/${currentBlockType}/${currentBlockId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        editDialog.close()
      } else {
        alert('Errore durante il salvataggio.')
      }
    } catch {
      alert('Errore di rete.')
    } finally {
      dialogSave.disabled = false
      dialogSave.textContent = 'Salva'
    }
  }

  async function deleteBlock(junctionId) {
    if (!confirm('Rimuovere questa sezione dalla pagina?')) return
    try {
      await fetch(`${directusUrl}/items/pages_blocks/${junctionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      window.location.reload()
    } catch {
      alert('Errore durante l\'eliminazione.')
    }
  }

  // Event listeners
  document.querySelectorAll('.edit-block-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditDialog(btn.dataset.blockType, btn.dataset.blockId)
    })
  })

  document.querySelectorAll('.delete-block-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteBlock(btn.dataset.junctionId))
  })

  dialogSave?.addEventListener('click', saveBlock)
  dialogClose?.addEventListener('click', () => editDialog.close())
  dialogCancel?.addEventListener('click', () => editDialog.close())

  // Add block dialog
  const addBlockBtn = document.getElementById('add-block-btn')
  const addDialog = document.getElementById('add-block-dialog')
  const addDialogBody = document.getElementById('add-dialog-body')
  const addDialogClose = document.getElementById('add-dialog-close')
  const addDialogCancel = document.getElementById('add-dialog-cancel')

  addBlockBtn?.addEventListener('click', async () => {
    addDialogBody.innerHTML = '<p style="color:#9ca3af;font-size:14px">Caricamento…</p>'
    addDialog.showModal()

    try {
      const res = await fetch(`${directusUrl}/collections`, { headers: { Authorization: `Bearer ${token}` } })
      const { data: collections } = await res.json()
      const blockCollections = collections.filter(c => c.collection.startsWith('block_'))

      if (!blockCollections.length) {
        addDialogBody.innerHTML = '<p style="color:#9ca3af;font-size:14px">Nessun tipo di blocco disponibile. Crea prima una collection con prefisso <code>block_</code> in Directus.</p>'
        return
      }

      addDialogBody.innerHTML = blockCollections.map(c => `
        <button type="button" class="add-block-type-btn"
          data-collection="${c.collection}"
          style="display:block;width:100%;text-align:left;border:1px solid #e5e7eb;background:#fff;padding:10px 14px;border-radius:6px;font-size:14px;color:#374151;cursor:pointer;margin-bottom:8px">
          ${c.collection.replace('block_', '').replace(/_/g, ' ')}
        </button>
      `).join('')

      document.querySelectorAll('.add-block-type-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const collection = btn.dataset.collection
          try {
            // Crea un record vuoto nella collection blocco
            const blockRes = await fetch(`${directusUrl}/items/${collection}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            })
            const { data: newBlock } = await blockRes.json()

            // Calcola sort massimo
            const lastSort = [...document.querySelectorAll('.block-row')].length

            // Crea il record nella junction
            await fetch(`${directusUrl}/items/pages_blocks`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ page_id: pageId, block_type: collection, block_id: newBlock.id, sort: lastSort + 1 }),
            })

            addDialog.close()
            window.location.reload()
          } catch {
            alert('Errore durante la creazione del blocco.')
          }
        })
      })
    } catch {
      addDialogBody.innerHTML = '<p style="color:#dc2626;font-size:14px">Errore caricamento collection.</p>'
    }
  })

  addDialogClose?.addEventListener('click', () => addDialog.close())
  addDialogCancel?.addEventListener('click', () => addDialog.close())

  // Chiudi dialog cliccando fuori
  editDialog?.addEventListener('click', e => { if (e.target === editDialog) editDialog.close() })
  addDialog?.addEventListener('click', e => { if (e.target === addDialog) addDialog.close() })
</script>
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add src/pages/admin/pages/
git commit -m "feat(admin): add pages list and block editor with dynamic field dialog"
```

---

## Task 4: Settings page

**Files:**
- Create: `src/pages/admin/settings/index.astro`

> **Contesto:** Form impostazioni sito. Cambia colori brand (primary + accent) con `input[type=color]` con live preview via CSS custom properties. Salva site_name, footer_text, primary_color, accent_color in Directus `site_settings` (collection singleton, id=1). Il JS aggiorna i CSS vars in tempo reale mentre il colore viene scelto.

- [ ] **Step 1: Creare `src/pages/admin/settings/index.astro`**

```astro
---
// src/pages/admin/settings/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...((opts?.headers as Record<string, string>) ?? {}) },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

let saveError: string | null = null

if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData()
  const payload = {
    site_name: formData.get('site_name') || null,
    footer_text: formData.get('footer_text') || null,
    primary_color: formData.get('primary_color') || null,
    accent_color: formData.get('accent_color') || null,
  }
  const result = await dFetch('/items/site_settings/1', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (result) {
    return Astro.redirect('/admin/settings?saved=1')
  } else {
    saveError = 'Errore durante il salvataggio.'
  }
}

const settingsRes = await dFetch('/items/site_settings/1?fields[]=*')
const settings = (settingsRes?.data ?? {}) as Record<string, unknown>
const saved = Astro.url.searchParams.get('saved') === '1'

const primaryColor = String(settings.primary_color ?? '#111827')
const accentColor = String(settings.accent_color ?? '#6366f1')
---

<AdminLayout title="Impostazioni" active="settings">

  <div style="margin-bottom:20px">
    <h1 style="font-size:18px;font-weight:700;color:#111827">Impostazioni sito</h1>
  </div>

  {saved && <p style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">✓ Impostazioni salvate.</p>}
  {saveError && <p style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">{saveError}</p>}

  <form method="POST">
    <div style="display:flex;flex-direction:column;gap:16px;max-width:640px">

      <SectionCard title="Informazioni negozio">
        <div style="display:flex;flex-direction:column;gap:14px">

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Nome sito</label>
            <input name="site_name" value={String(settings.site_name ?? '')}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Testo footer</label>
            <textarea name="footer_text" rows={3}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;resize:vertical">{String(settings.footer_text ?? '')}</textarea>
          </div>

        </div>
      </SectionCard>

      <SectionCard title="Colori brand">
        <p style="font-size:13px;color:#6b7280;margin:0 0 16px">I colori vengono applicati come CSS custom properties (<code>--admin-primary</code>, <code>--admin-accent</code>) nel pannello admin. Aggiornati in tempo reale mentre scegli.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:8px">Colore primario</label>
            <div style="display:flex;align-items:center;gap:10px">
              <input type="color" id="primary-color-input" name="primary_color" value={primaryColor}
                style="width:48px;height:48px;border:1px solid #d1d5db;border-radius:6px;padding:4px;cursor:pointer" />
              <div>
                <div id="primary-preview" style={`width:120px;height:32px;border-radius:6px;background:${primaryColor}`}></div>
                <code id="primary-hex" style="font-size:12px;color:#6b7280">{primaryColor}</code>
              </div>
            </div>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:8px">Colore accent</label>
            <div style="display:flex;align-items:center;gap:10px">
              <input type="color" id="accent-color-input" name="accent_color" value={accentColor}
                style="width:48px;height:48px;border:1px solid #d1d5db;border-radius:6px;padding:4px;cursor:pointer" />
              <div>
                <div id="accent-preview" style={`width:120px;height:32px;border-radius:6px;background:${accentColor}`}></div>
                <code id="accent-hex" style="font-size:12px;color:#6b7280">{accentColor}</code>
              </div>
            </div>
          </div>

        </div>
      </SectionCard>

      <div style="display:flex;justify-content:flex-end">
        <button type="submit"
          style="background:#111827;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer">
          Salva impostazioni
        </button>
      </div>

    </div>
  </form>

</AdminLayout>

<script>
  const primaryInput = document.getElementById('primary-color-input') as HTMLInputElement | null
  const accentInput = document.getElementById('accent-color-input') as HTMLInputElement | null
  const primaryPreview = document.getElementById('primary-preview')
  const accentPreview = document.getElementById('accent-preview')
  const primaryHex = document.getElementById('primary-hex')
  const accentHex = document.getElementById('accent-hex')

  primaryInput?.addEventListener('input', () => {
    const color = primaryInput.value
    if (primaryPreview) primaryPreview.style.background = color
    if (primaryHex) primaryHex.textContent = color
    document.documentElement.style.setProperty('--admin-primary', color)
  })

  accentInput?.addEventListener('input', () => {
    const color = accentInput.value
    if (accentPreview) accentPreview.style.background = color
    if (accentHex) accentHex.textContent = color
    document.documentElement.style.setProperty('--admin-accent', color)
  })
</script>
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add src/pages/admin/settings/
git commit -m "feat(admin): add settings page with live color picker"
```

---

## Task 5: Sync ottica-marangon

**Files da copiare:**
- `src/pages/admin/forms/index.astro`
- `src/pages/admin/forms/[id].astro`
- `src/pages/admin/articles/index.astro`
- `src/pages/admin/articles/[id].astro`
- `src/pages/admin/pages/index.astro`
- `src/pages/admin/pages/[id].astro`
- `src/pages/admin/settings/index.astro`

- [ ] **Step 1: Copiare i file**

```bash
TEMPLATE="/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
TARGET="/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"

mkdir -p "$TARGET/src/pages/admin/forms"
mkdir -p "$TARGET/src/pages/admin/articles"
mkdir -p "$TARGET/src/pages/admin/pages"
mkdir -p "$TARGET/src/pages/admin/settings"

cp "$TEMPLATE/src/pages/admin/forms/index.astro" "$TARGET/src/pages/admin/forms/index.astro"
cp "$TEMPLATE/src/pages/admin/forms/[id].astro" "$TARGET/src/pages/admin/forms/[id].astro"
cp "$TEMPLATE/src/pages/admin/articles/index.astro" "$TARGET/src/pages/admin/articles/index.astro"
cp "$TEMPLATE/src/pages/admin/articles/[id].astro" "$TARGET/src/pages/admin/articles/[id].astro"
cp "$TEMPLATE/src/pages/admin/pages/index.astro" "$TARGET/src/pages/admin/pages/index.astro"
cp "$TEMPLATE/src/pages/admin/pages/[id].astro" "$TARGET/src/pages/admin/pages/[id].astro"
cp "$TEMPLATE/src/pages/admin/settings/index.astro" "$TARGET/src/pages/admin/settings/index.astro"
```

- [ ] **Step 2: Commit nel target**

```bash
cd "/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"
git add src/pages/admin/forms/ \
        src/pages/admin/articles/ \
        src/pages/admin/pages/ \
        src/pages/admin/settings/
git commit -m "feat(admin): sync Content & Settings pages from template"
```

---

## Checklist finale Piano 4

- [ ] `/admin/forms` carica lista form
- [ ] `/admin/forms/{id}` mostra configurazione + submissions paginate
- [ ] `/admin/articles` carica lista articoli
- [ ] `/admin/articles/{id}` form editabile con body textarea, stato, SEO
- [ ] `/admin/pages` carica lista pagine
- [ ] `/admin/pages/{id}` mostra metadata form (sinistra) + blocchi lista (destra)
- [ ] Dialog "Modifica blocco" carica campi Directus dinamicamente e salva via PATCH
- [ ] Dialog "Aggiungi sezione" mostra collection `block_*` disponibili
- [ ] `/admin/settings` form con color picker live + nome sito
- [ ] Entrambi i repo sincronizzati e committati
