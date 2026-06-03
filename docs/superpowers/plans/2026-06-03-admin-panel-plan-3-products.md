# Admin Panel — Piano 3: Products & Commerce

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare le pagine Commerce del pannello admin: prodotti, categorie prodotti, varianti, coupon, gift card, zone di spedizione.

**Architecture:** Pagine Astro SSR con `prerender = false`. Liste con `DataTable`, dettagli con `SectionCard`. Form con gestione server-side (`Astro.request.method === 'POST'` + `request.formData()`). Tutti i dati via Directus REST API con token JWT dal cookie `admin_token`.

**Tech Stack:** Astro SSR, DataTable, SectionCard, AdminLayout (tutti già implementati), Directus REST API

**Spec di riferimento:** `docs/superpowers/specs/2026-06-02-admin-panel-design.md`

**Prerequisiti:** Piani 1 e 2 completati.

---

## File Structure

```
src/
  pages/
    admin/
      products/
        index.astro                    ← NUOVO: lista prodotti
        categories/
          index.astro                  ← NUOVO: lista categorie
          [id].astro                   ← NUOVO: form categoria (create/edit)
        [id].astro                     ← NUOVO: dettaglio prodotto + varianti
      coupons/
        index.astro                    ← NUOVO: lista coupon
        [id].astro                     ← NUOVO: form coupon (edit)
      gift-cards/
        index.astro                    ← NUOVO: lista gift card
        [id].astro                     ← NUOVO: dettaglio gift card + storico
      shipping/
        index.astro                    ← NUOVO: lista zone spedizione
        [id].astro                     ← NUOVO: form zona spedizione (edit)
```

---

## Helper condiviso — dFetch

Ogni file include questo helper nella frontmatter:

```typescript
const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}
```

---

## Task 1: Products list page

**Files:**
- Create: `src/pages/admin/products/index.astro`

> **Contesto:** Lista prodotti con DataTable. Colonne: nome, SKU (prima variante), prezzo base, stato, tipo, categoria.

- [ ] **Step 1: Creare `src/pages/admin/products/index.astro`**

```astro
---
// src/pages/admin/products/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { Product } from '@/lib/types'

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
  dFetch(`/items/products?fields[]=id,name,slug,base_price,status,type,is_active,category_id.name,variants.sku&sort[]=sort_order&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/products?aggregate[count]=id'),
])

type ProductRow = Pick<Product, 'id' | 'name' | 'slug' | 'base_price' | 'status' | 'type' | 'is_active'> & {
  category_id: { name: string } | null
  variants: Array<{ sku: string }>
}

const products = (listRes?.data ?? []) as ProductRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  {
    key: 'name',
    label: 'Prodotto',
    format: (v) => `<span style="font-weight:500;color:#111827">${String(v ?? '—')}</span>`,
  },
  {
    key: 'variants',
    label: 'SKU',
    format: (v) => {
      const variants = v as Array<{ sku: string }> | null
      const sku = variants?.[0]?.sku ?? '—'
      return `<span style="font-family:monospace;font-size:12px;color:#6b7280">${sku}</span>`
    },
  },
  {
    key: 'base_price',
    label: 'Prezzo',
    format: (v) => `<span style="font-weight:500">€${Number(v ?? 0).toFixed(2)}</span>`,
  },
  {
    key: 'category_id',
    label: 'Categoria',
    format: (v) => {
      const cat = v as { name: string } | null
      return `<span style="color:#6b7280;font-size:13px">${cat?.name ?? '—'}</span>`
    },
  },
  {
    key: 'type',
    label: 'Tipo',
    format: (v) => v === 'digital'
      ? `<span style="background:#eff6ff;color:#3b82f6;padding:2px 8px;border-radius:10px;font-size:12px">Digitale</span>`
      : `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Fisico</span>`,
  },
  {
    key: 'status',
    label: 'Stato',
    format: (v) => v === 'published'
      ? `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Pubblicato</span>`
      : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:12px">Bozza</span>`,
  },
]
---

<AdminLayout title="Prodotti" active="products">
  <DataTable
    columns={columns}
    rows={products as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/products/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessun prodotto trovato."
  />
</AdminLayout>
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add src/pages/admin/products/index.astro
git commit -m "feat(admin): add products list page"
```

---

## Task 2: Product categories — list + detail form

**Files:**
- Create: `src/pages/admin/products/categories/index.astro`
- Create: `src/pages/admin/products/categories/[id].astro`

> **Contesto:** Lista categorie con DataTable. Form dettaglio con nome, slug, descrizione, parent dropdown.

- [ ] **Step 1: Creare `src/pages/admin/products/categories/index.astro`**

```astro
---
// src/pages/admin/products/categories/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { ProductCategory } from '@/lib/types'

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

const PAGE_SIZE = 50
const page = Math.max(1, parseInt(Astro.url.searchParams.get('page') ?? '1'))
const offset = (page - 1) * PAGE_SIZE

const [listRes, countRes] = await Promise.all([
  dFetch(`/items/product_categories?fields[]=id,name,slug,parent_id.name,sort_order&sort[]=sort_order&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/product_categories?aggregate[count]=id'),
])

type CatRow = Pick<ProductCategory, 'id' | 'name' | 'slug' | 'sort_order'> & {
  parent_id: { name: string } | null
}

const categories = (listRes?.data ?? []) as CatRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  { key: 'name', label: 'Nome', format: (v) => `<span style="font-weight:500;color:#111827">${String(v ?? '—')}</span>` },
  { key: 'slug', label: 'Slug', format: (v) => `<span style="font-family:monospace;font-size:12px;color:#6b7280">${String(v ?? '—')}</span>` },
  {
    key: 'parent_id',
    label: 'Parent',
    format: (v) => {
      const p = v as { name: string } | null
      return p?.name ? `<span style="color:#6b7280;font-size:13px">${p.name}</span>` : '<span style="color:#d1d5db">—</span>'
    },
  },
  { key: 'sort_order', label: 'Ordine', format: (v) => `<span style="color:#6b7280">${String(v ?? 0)}</span>` },
]
---

<AdminLayout title="Categorie prodotti" active="products">
  <DataTable
    columns={columns}
    rows={categories as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/products/categories/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessuna categoria trovata."
  />
</AdminLayout>
```

- [ ] **Step 2: Creare `src/pages/admin/products/categories/[id].astro`**

```astro
---
// src/pages/admin/products/categories/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { ProductCategory } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/products/categories')

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
let saveSuccess = false

if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData()
  const payload = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description') || null,
    parent_id: formData.get('parent_id') || null,
    sort_order: parseInt(String(formData.get('sort_order') ?? '0')),
    seo_title: formData.get('seo_title') || null,
    seo_description: formData.get('seo_description') || null,
  }
  const result = await dFetch(`/items/product_categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (result) {
    return Astro.redirect(`/admin/products/categories/${id}?saved=1`)
  } else {
    saveError = 'Errore durante il salvataggio. Riprova.'
  }
}

const [catRes, allCatsRes] = await Promise.all([
  dFetch(`/items/product_categories/${id}?fields[]=*`),
  dFetch('/items/product_categories?fields[]=id,name&sort[]=sort_order&limit=100'),
])

if (!catRes?.data) return Astro.redirect('/admin/products/categories')

const cat = catRes.data as ProductCategory & { parent_id: string | null }
const allCats = (allCatsRes?.data ?? []) as Array<{ id: string; name: string }>
const saved = Astro.url.searchParams.get('saved') === '1'
---

<AdminLayout title={cat.name} active="products">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/products/categories" style="color:#6b7280;text-decoration:none;font-size:13px">← Categorie</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">{cat.name}</h1>
  </div>

  {saved && <p style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">✓ Salvato con successo.</p>}
  {saveError && <p style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">{saveError}</p>}

  <form method="POST">
    <div style="display:flex;flex-direction:column;gap:16px">

      <SectionCard title="Informazioni categoria">
        <div style="display:flex;flex-direction:column;gap:14px">

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Nome *</label>
            <input name="name" required value={cat.name}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Slug *</label>
            <input name="slug" required value={cat.slug}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;font-family:monospace;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Categoria parent</label>
            <select name="parent_id"
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;background:#fff">
              <option value="">— nessuna —</option>
              {allCats.filter(c => c.id !== id).map(c => (
                <option value={c.id} selected={cat.parent_id === c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Descrizione</label>
            <textarea name="description" rows={3}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;resize:vertical">{cat.description ?? ''}</textarea>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Ordine</label>
            <input name="sort_order" type="number" value={cat.sort_order ?? 0}
              style="width:120px;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827" />
          </div>

        </div>
      </SectionCard>

      <SectionCard title="SEO">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">SEO Title</label>
            <input name="seo_title" value={cat.seo_title ?? ''}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">SEO Description</label>
            <textarea name="seo_description" rows={2}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;resize:vertical">{cat.seo_description ?? ''}</textarea>
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
git add src/pages/admin/products/categories/
git commit -m "feat(admin): add product categories list and detail form"
```

---

## Task 3: Product detail page

**Files:**
- Create: `src/pages/admin/products/[id].astro`

> **Contesto:** Dettaglio prodotto con sezioni SectionCard: info principale, descrizione, varianti (tabella inline). Non è un form di editing completo — il focus è visualizzare info e varianti. Lo status può essere cambiato con un mini-form inline.

- [ ] **Step 1: Creare `src/pages/admin/products/[id].astro`**

```astro
---
// src/pages/admin/products/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { Product } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/products')

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

// Mini-form per cambio stato
if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData()
  const newStatus = formData.get('status')
  if (newStatus === 'published' || newStatus === 'draft') {
    const result = await dFetch(`/items/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    })
    if (result) {
      return Astro.redirect(`/admin/products/${id}?saved=1`)
    } else {
      saveError = 'Errore durante il salvataggio.'
    }
  }
}

const productRes = await dFetch(`/items/products/${id}?fields[]=*,variants.*,category_id.name,category_id.id`)
if (!productRes?.data) return Astro.redirect('/admin/products')

const product = productRes.data as Product & { category_id: { id: string; name: string } | null }
const saved = Astro.url.searchParams.get('saved') === '1'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
---

<AdminLayout title={product.name} active="products">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/products" style="color:#6b7280;text-decoration:none;font-size:13px">← Prodotti</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">{product.name}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${
      product.status === 'published' ? 'background:#f0fdf4;color:#22c55e' : 'background:#f3f4f6;color:#6b7280'
    }`}>{product.status === 'published' ? 'Pubblicato' : 'Bozza'}</span>
  </div>

  {saved && <p style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">✓ Stato aggiornato.</p>}
  {saveError && <p style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">{saveError}</p>}

  <div style="display:flex;flex-direction:column;gap:16px">

    <!-- Info principali -->
    <SectionCard title="Informazioni prodotto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px">
        <div><span style="color:#6b7280">Slug:</span> <code style="font-size:12px">{product.slug}</code></div>
        <div><span style="color:#6b7280">Tipo:</span> {product.type === 'digital' ? 'Digitale' : 'Fisico'}</div>
        <div><span style="color:#6b7280">Prezzo base:</span> <strong>€{product.base_price.toFixed(2)}</strong></div>
        {product.compare_price && <div><span style="color:#6b7280">Prezzo barrato:</span> €{product.compare_price.toFixed(2)}</div>}
        <div><span style="color:#6b7280">Categoria:</span> {product.category_id?.name ?? '—'}</div>
        <div><span style="color:#6b7280">Stripe ID:</span> <code style="font-size:11px;color:#6b7280">{product.stripe_product_id}</code></div>
        <div><span style="color:#6b7280">Peso:</span> {product.weight_g}g</div>
        <div><span style="color:#6b7280">In evidenza:</span> {product.featured ? 'Sì' : 'No'}</div>
        {product.seo_title && <div style="grid-column:span 2"><span style="color:#6b7280">SEO title:</span> {product.seo_title}</div>}
      </div>
    </SectionCard>

    <!-- Descrizione -->
    {product.description && (
      <SectionCard title="Descrizione">
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0">{product.description}</p>
      </SectionCard>
    )}

    <!-- Cambio stato -->
    <SectionCard title="Pubblica / Archivia">
      <form method="POST" style="display:flex;gap:10px;align-items:center">
        <select name="status"
          style="border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;background:#fff">
          <option value="published" selected={product.status === 'published'}>Pubblicato</option>
          <option value="draft" selected={product.status === 'draft'}>Bozza</option>
        </select>
        <button type="submit"
          style="background:#111827;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer">
          Aggiorna stato
        </button>
      </form>
    </SectionCard>

    <!-- Varianti -->
    <SectionCard title={`Varianti (${product.variants?.length ?? 0})`}>
      {!product.variants?.length
        ? <p style="color:#9ca3af;font-size:14px">Nessuna variante.</p>
        : (
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:14px;min-width:600px">
              <thead>
                <tr style="border-bottom:1px solid #e5e7eb">
                  <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">SKU</th>
                  <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Nome</th>
                  <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Opzione 1</th>
                  <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Opzione 2</th>
                  <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Prezzo</th>
                  <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Stock</th>
                  <th style="text-align:center;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Attiva</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map(v => (
                  <tr style="border-bottom:1px solid #f3f4f6">
                    <td style="padding:8px;font-family:monospace;font-size:12px;color:#6b7280">{v.sku}</td>
                    <td style="padding:8px;font-weight:500">{v.name}</td>
                    <td style="padding:8px;color:#6b7280">{v.option_1_name ? `${v.option_1_name}: ${v.option_1_value}` : '—'}</td>
                    <td style="padding:8px;color:#6b7280">{v.option_2_name ? `${v.option_2_name}: ${v.option_2_value}` : '—'}</td>
                    <td style="padding:8px;text-align:right">{v.price_override != null ? `€${v.price_override.toFixed(2)}` : '—'}</td>
                    <td style="padding:8px;text-align:right">
                      <span style={v.stock_quantity <= v.low_stock_threshold ? 'color:#f97316;font-weight:500' : ''}>
                        {v.stock_quantity}
                      </span>
                    </td>
                    <td style="padding:8px;text-align:center">
                      {v.is_active
                        ? `<span style="color:#22c55e">●</span>`
                        : `<span style="color:#d1d5db">●</span>`
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </SectionCard>

  </div>
</AdminLayout>
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add "src/pages/admin/products/[id].astro"
git commit -m "feat(admin): add product detail page with variants table"
```

---

## Task 4: Coupons — list + detail form

**Files:**
- Create: `src/pages/admin/coupons/index.astro`
- Create: `src/pages/admin/coupons/[id].astro`

- [ ] **Step 1: Creare `src/pages/admin/coupons/index.astro`**

```astro
---
// src/pages/admin/coupons/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { Coupon } from '@/lib/types'

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
  dFetch(`/items/coupons?fields[]=id,code,type,value,expires_at,used_count,max_uses,is_active&sort[]=-date_created&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/coupons?aggregate[count]=id'),
])

type CouponRow = Pick<Coupon, 'id' | 'code' | 'type' | 'value' | 'expires_at' | 'used_count' | 'max_uses' | 'is_active'>

const coupons = (listRes?.data ?? []) as CouponRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  { key: 'code', label: 'Codice', format: (v) => `<span style="font-family:monospace;font-weight:600;color:#111827">${String(v ?? '—')}</span>` },
  {
    key: 'type',
    label: 'Tipo',
    format: (v) => v === 'percent'
      ? `<span style="color:#6b7280;font-size:13px">Percentuale</span>`
      : `<span style="color:#6b7280;font-size:13px">Fisso</span>`,
  },
  {
    key: 'value',
    label: 'Valore',
    format: (_, row) => {
      const r = row as CouponRow
      return r.type === 'percent' ? `${r.value}%` : `€${r.value.toFixed(2)}`
    },
  },
  {
    key: 'expires_at',
    label: 'Scadenza',
    format: (v) => v ? new Date(String(v)).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—',
  },
  {
    key: 'used_count',
    label: 'Utilizzi',
    format: (_, row) => {
      const r = row as CouponRow
      return `${r.used_count ?? 0}${r.max_uses ? ` / ${r.max_uses}` : ''}`
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

<AdminLayout title="Coupon" active="coupons">
  <DataTable
    columns={columns}
    rows={coupons as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/coupons/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessun coupon trovato."
  />
</AdminLayout>
```

- [ ] **Step 2: Creare `src/pages/admin/coupons/[id].astro`**

```astro
---
// src/pages/admin/coupons/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { Coupon } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/coupons')

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
  const payload: Record<string, unknown> = {
    code: formData.get('code'),
    type: formData.get('type'),
    value: parseFloat(String(formData.get('value') ?? '0')),
    is_active: formData.get('is_active') === 'true',
    description: formData.get('description') || null,
    min_order_amount: formData.get('min_order_amount') ? parseFloat(String(formData.get('min_order_amount'))) : null,
    max_uses: formData.get('max_uses') ? parseInt(String(formData.get('max_uses'))) : null,
    expires_at: formData.get('expires_at') || null,
  }
  const result = await dFetch(`/items/coupons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (result) {
    return Astro.redirect(`/admin/coupons/${id}?saved=1`)
  } else {
    saveError = 'Errore durante il salvataggio.'
  }
}

const couponRes = await dFetch(`/items/coupons/${id}?fields[]=*`)
if (!couponRes?.data) return Astro.redirect('/admin/coupons')

const coupon = couponRes.data as Coupon
const saved = Astro.url.searchParams.get('saved') === '1'

// Formatta data ISO per input[type=datetime-local]
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}
---

<AdminLayout title={`Coupon: ${coupon.code}`} active="coupons">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/coupons" style="color:#6b7280;text-decoration:none;font-size:13px">← Coupon</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827;font-family:monospace">{coupon.code}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${
      coupon.is_active ? 'background:#f0fdf4;color:#22c55e' : 'background:#f3f4f6;color:#6b7280'
    }`}>{coupon.is_active ? 'Attivo' : 'Inattivo'}</span>
  </div>

  {saved && <p style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">✓ Salvato con successo.</p>}
  {saveError && <p style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">{saveError}</p>}

  <form method="POST">
    <div style="display:flex;flex-direction:column;gap:16px">

      <SectionCard title="Dettagli coupon">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Codice *</label>
            <input name="code" required value={coupon.code}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;font-family:monospace;text-transform:uppercase;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Stato</label>
            <select name="is_active"
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;background:#fff;box-sizing:border-box">
              <option value="true" selected={coupon.is_active}>Attivo</option>
              <option value="false" selected={!coupon.is_active}>Inattivo</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Tipo sconto *</label>
            <select name="type"
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;background:#fff;box-sizing:border-box">
              <option value="percent" selected={coupon.type === 'percent'}>Percentuale (%)</option>
              <option value="fixed" selected={coupon.type === 'fixed'}>Fisso (€)</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Valore *</label>
            <input name="value" type="number" step="0.01" min="0" required value={coupon.value}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Ordine minimo (€)</label>
            <input name="min_order_amount" type="number" step="0.01" min="0" value={coupon.min_order_amount ?? ''}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Max utilizzi</label>
            <input name="max_uses" type="number" min="0" value={coupon.max_uses ?? ''}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div style="grid-column:span 2">
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Scadenza</label>
            <input name="expires_at" type="datetime-local" value={toDatetimeLocal(coupon.expires_at)}
              style="border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827" />
          </div>

          <div style="grid-column:span 2">
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Descrizione interna</label>
            <textarea name="description" rows={2}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box;resize:vertical">{coupon.description ?? ''}</textarea>
          </div>

        </div>
      </SectionCard>

      <!-- Utilizzi (read-only) -->
      <SectionCard title="Utilizzi">
        <p style="font-size:14px;color:#374151">
          Utilizzato <strong>{coupon.used_count ?? 0}</strong>
          {coupon.max_uses ? ` volte su ${coupon.max_uses} disponibili.` : ' volte (nessun limite).'}
        </p>
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
git add src/pages/admin/coupons/
git commit -m "feat(admin): add coupons list and detail form"
```

---

## Task 5: Gift cards — list + detail

**Files:**
- Create: `src/pages/admin/gift-cards/index.astro`
- Create: `src/pages/admin/gift-cards/[id].astro`

- [ ] **Step 1: Creare `src/pages/admin/gift-cards/index.astro`**

```astro
---
// src/pages/admin/gift-cards/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { GiftCard } from '@/lib/types'

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
  dFetch(`/items/gift_cards?fields[]=id,code,initial_value,remaining_value,expires_at,is_active&sort[]=-date_created&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/gift_cards?aggregate[count]=id'),
])

type GiftCardRow = Pick<GiftCard, 'id' | 'code' | 'initial_value' | 'remaining_value' | 'expires_at' | 'is_active'>

const cards = (listRes?.data ?? []) as GiftCardRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  { key: 'code', label: 'Codice', format: (v) => `<span style="font-family:monospace;font-weight:600;color:#111827">${String(v ?? '—')}</span>` },
  { key: 'initial_value', label: 'Valore iniziale', format: (v) => `€${Number(v ?? 0).toFixed(2)}` },
  {
    key: 'remaining_value',
    label: 'Saldo residuo',
    format: (v) => {
      const n = Number(v ?? 0)
      return `<span style="font-weight:500;${n === 0 ? 'color:#9ca3af' : 'color:#111827'}">€${n.toFixed(2)}</span>`
    },
  },
  {
    key: 'expires_at',
    label: 'Scadenza',
    format: (v) => {
      if (!v) return '—'
      const d = new Date(String(v))
      const expired = d < new Date()
      return `<span style="${expired ? 'color:#dc2626' : 'color:#6b7280'}">${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>`
    },
  },
  {
    key: 'is_active',
    label: 'Stato',
    format: (v) => v
      ? `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Attiva</span>`
      : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:12px">Inattiva</span>`,
  },
]
---

<AdminLayout title="Gift card" active="gift-cards">
  <DataTable
    columns={columns}
    rows={cards as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/gift-cards/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessuna gift card trovata."
  />
</AdminLayout>
```

- [ ] **Step 2: Creare `src/pages/admin/gift-cards/[id].astro`**

```astro
---
// src/pages/admin/gift-cards/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { GiftCard } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/gift-cards')

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

const cardRes = await dFetch(`/items/gift_cards/${id}?fields[]=*`)
if (!cardRes?.data) return Astro.redirect('/admin/gift-cards')

const card = cardRes.data as GiftCard

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const isExpired = card.expires_at ? new Date(card.expires_at) < new Date() : false
const percentUsed = card.initial_value > 0 ? Math.round((1 - card.remaining_value / card.initial_value) * 100) : 0
---

<AdminLayout title={`Gift card: ${card.code}`} active="gift-cards">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/gift-cards" style="color:#6b7280;text-decoration:none;font-size:13px">← Gift card</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827;font-family:monospace">{card.code}</h1>
    {isExpired
      ? <span style="padding:3px 10px;border-radius:10px;font-size:12px;background:#fef2f2;color:#dc2626">Scaduta</span>
      : card.is_active
        ? <span style="padding:3px 10px;border-radius:10px;font-size:12px;background:#f0fdf4;color:#22c55e">Attiva</span>
        : <span style="padding:3px 10px;border-radius:10px;font-size:12px;background:#f3f4f6;color:#6b7280">Inattiva</span>
    }
  </div>

  <div style="display:flex;flex-direction:column;gap:16px">

    <!-- Riepilogo -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      <SectionCard>
        <div style="text-align:center">
          <div style="font-size:24px;font-weight:700;color:#111827">€{card.initial_value.toFixed(2)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Valore iniziale</div>
        </div>
      </SectionCard>
      <SectionCard>
        <div style="text-align:center">
          <div style="font-size:24px;font-weight:700;${card.remaining_value === 0 ? 'color:#9ca3af' : 'color:#111827'}">€{card.remaining_value.toFixed(2)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Saldo residuo</div>
        </div>
      </SectionCard>
      <SectionCard>
        <div style="text-align:center">
          <div style="font-size:24px;font-weight:700;color:#111827">{percentUsed}%</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Utilizzata</div>
        </div>
      </SectionCard>
    </div>

    <!-- Info -->
    <SectionCard title="Dettagli">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px">
        <div><span style="color:#6b7280">Scadenza:</span> {fmtDate(card.expires_at)}</div>
        <div><span style="color:#6b7280">Stato:</span> {card.is_active ? 'Attiva' : 'Inattiva'}</div>
      </div>
    </SectionCard>

    <!-- Storico utilizzi -->
    <SectionCard title={`Storico utilizzi (${card.redemptions?.length ?? 0})`}>
      {!card.redemptions?.length
        ? <p style="color:#9ca3af;font-size:14px">Nessun utilizzo.</p>
        : (
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="border-bottom:1px solid #e5e7eb">
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Data</th>
                <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Importo</th>
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Ordine</th>
              </tr>
            </thead>
            <tbody>
              {card.redemptions.map(r => (
                <tr style="border-bottom:1px solid #f3f4f6">
                  <td style="padding:8px;color:#6b7280">{fmtDate(r.date)}</td>
                  <td style="padding:8px;text-align:right;color:#dc2626;font-weight:500">-€{r.amount.toFixed(2)}</td>
                  <td style="padding:8px">
                    <a href={`/admin/orders/${r.order_id}`} style="color:#3b82f6;font-family:monospace;font-size:12px">
                      #{r.order_id.slice(0, 8)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </SectionCard>

  </div>
</AdminLayout>
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add src/pages/admin/gift-cards/
git commit -m "feat(admin): add gift cards list and detail with redemption history"
```

---

## Task 6: Shipping zones — list + detail form

**Files:**
- Create: `src/pages/admin/shipping/index.astro`
- Create: `src/pages/admin/shipping/[id].astro`

> **Contesto:** Il campo `countries` è un JSON array di codici ISO 3166-1 alpha-2. Nel form viene gestito con `<select multiple>`. La lista paesi è hardcodata nel frontend (focus su Europa + principali mercati).

- [ ] **Step 1: Creare `src/pages/admin/shipping/index.astro`**

```astro
---
// src/pages/admin/shipping/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'
import type { ShippingZone } from '@/lib/types'

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

const PAGE_SIZE = 50
const page = Math.max(1, parseInt(Astro.url.searchParams.get('page') ?? '1'))
const offset = (page - 1) * PAGE_SIZE

const [listRes, countRes] = await Promise.all([
  dFetch(`/items/shipping_zones?fields[]=id,name,countries,base_rate,is_active&sort[]=name&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/shipping_zones?aggregate[count]=id'),
])

type ZoneRow = Pick<ShippingZone, 'id' | 'name' | 'countries' | 'base_rate' | 'is_active'>

const zones = (listRes?.data ?? []) as ZoneRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  { key: 'name', label: 'Zona', format: (v) => `<span style="font-weight:500;color:#111827">${String(v ?? '—')}</span>` },
  {
    key: 'countries',
    label: 'Paesi',
    format: (v) => {
      const countries = v as string[] | null
      if (!countries?.length) return '<span style="color:#9ca3af">—</span>'
      const display = countries.slice(0, 5).join(', ')
      const extra = countries.length > 5 ? ` +${countries.length - 5}` : ''
      return `<span style="font-family:monospace;font-size:12px;color:#6b7280">${display}${extra}</span>`
    },
  },
  { key: 'base_rate', label: 'Tariffa base', format: (v) => `€${Number(v ?? 0).toFixed(2)}` },
  {
    key: 'is_active',
    label: 'Stato',
    format: (v) => v
      ? `<span style="background:#f0fdf4;color:#22c55e;padding:2px 8px;border-radius:10px;font-size:12px">Attiva</span>`
      : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:12px">Inattiva</span>`,
  },
]
---

<AdminLayout title="Spedizioni" active="shipping">
  <DataTable
    columns={columns}
    rows={zones as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/shipping/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessuna zona di spedizione trovata."
  />
</AdminLayout>
```

- [ ] **Step 2: Creare `src/pages/admin/shipping/[id].astro`**

```astro
---
// src/pages/admin/shipping/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { ShippingZone } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/shipping')

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
  const countries = formData.getAll('countries').map(String)
  const payload = {
    name: formData.get('name'),
    countries,
    base_rate: parseFloat(String(formData.get('base_rate') ?? '0')),
    rate_per_kg: parseFloat(String(formData.get('rate_per_kg') ?? '0')),
    free_shipping_threshold: formData.get('free_shipping_threshold') ? parseFloat(String(formData.get('free_shipping_threshold'))) : null,
    max_weight_g: formData.get('max_weight_g') ? parseInt(String(formData.get('max_weight_g'))) : null,
    is_active: formData.get('is_active') === 'true',
  }
  const result = await dFetch(`/items/shipping_zones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (result) {
    return Astro.redirect(`/admin/shipping/${id}?saved=1`)
  } else {
    saveError = 'Errore durante il salvataggio.'
  }
}

const zoneRes = await dFetch(`/items/shipping_zones/${id}?fields[]=*`)
if (!zoneRes?.data) return Astro.redirect('/admin/shipping')

const zone = zoneRes.data as ShippingZone
const saved = Astro.url.searchParams.get('saved') === '1'

const COUNTRIES = [
  { code: 'IT', name: 'Italia' },
  { code: 'DE', name: 'Germania' },
  { code: 'FR', name: 'Francia' },
  { code: 'ES', name: 'Spagna' },
  { code: 'PT', name: 'Portogallo' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Svizzera' },
  { code: 'BE', name: 'Belgio' },
  { code: 'NL', name: 'Paesi Bassi' },
  { code: 'LU', name: 'Lussemburgo' },
  { code: 'PL', name: 'Polonia' },
  { code: 'CZ', name: 'Repubblica Ceca' },
  { code: 'HU', name: 'Ungheria' },
  { code: 'SK', name: 'Slovacchia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'HR', name: 'Croazia' },
  { code: 'GR', name: 'Grecia' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'SE', name: 'Svezia' },
  { code: 'DK', name: 'Danimarca' },
  { code: 'FI', name: 'Finlandia' },
  { code: 'NO', name: 'Norvegia' },
  { code: 'GB', name: 'Regno Unito' },
  { code: 'IE', name: 'Irlanda' },
  { code: 'US', name: 'Stati Uniti' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Giappone' },
]
---

<AdminLayout title={zone.name} active="shipping">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/shipping" style="color:#6b7280;text-decoration:none;font-size:13px">← Spedizioni</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">{zone.name}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${
      zone.is_active ? 'background:#f0fdf4;color:#22c55e' : 'background:#f3f4f6;color:#6b7280'
    }`}>{zone.is_active ? 'Attiva' : 'Inattiva'}</span>
  </div>

  {saved && <p style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">✓ Salvato con successo.</p>}
  {saveError && <p style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px">{saveError}</p>}

  <form method="POST">
    <div style="display:flex;flex-direction:column;gap:16px">

      <SectionCard title="Informazioni zona">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

          <div style="grid-column:span 2">
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Nome zona *</label>
            <input name="name" required value={zone.name}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Stato</label>
            <select name="is_active"
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;background:#fff;box-sizing:border-box">
              <option value="true" selected={zone.is_active}>Attiva</option>
              <option value="false" selected={!zone.is_active}>Inattiva</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Tariffa base (€) *</label>
            <input name="base_rate" type="number" step="0.01" min="0" required value={zone.base_rate}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Tariffa per kg (€)</label>
            <input name="rate_per_kg" type="number" step="0.01" min="0" value={zone.rate_per_kg ?? 0}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Spedizione gratuita da (€)</label>
            <input name="free_shipping_threshold" type="number" step="0.01" min="0" value={zone.free_shipping_threshold ?? ''}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:4px">Peso massimo (g)</label>
            <input name="max_weight_g" type="number" min="0" value={zone.max_weight_g ?? ''}
              style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 12px;font-size:14px;color:#111827;box-sizing:border-box" />
          </div>

        </div>
      </SectionCard>

      <SectionCard title="Paesi inclusi">
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px">Tieni premuto Ctrl (o Cmd su Mac) per selezionare più paesi.</p>
        <select name="countries" multiple size={10}
          style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:4px;font-size:14px;color:#111827;background:#fff">
          {COUNTRIES.map(c => (
            <option value={c.code} selected={(zone.countries ?? []).includes(c.code)}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        <p style="font-size:12px;color:#6b7280;margin:6px 0 0">Selezionati: {(zone.countries ?? []).join(', ') || '—'}</p>
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
git add src/pages/admin/shipping/
git commit -m "feat(admin): add shipping zones list and detail form"
```

---

## Task 7: Sync ottica-marangon

**Files da copiare:**
- `src/pages/admin/products/index.astro`
- `src/pages/admin/products/categories/index.astro`
- `src/pages/admin/products/categories/[id].astro`
- `src/pages/admin/products/[id].astro`
- `src/pages/admin/coupons/index.astro`
- `src/pages/admin/coupons/[id].astro`
- `src/pages/admin/gift-cards/index.astro`
- `src/pages/admin/gift-cards/[id].astro`
- `src/pages/admin/shipping/index.astro`
- `src/pages/admin/shipping/[id].astro`

- [ ] **Step 1: Copiare i file**

```bash
TEMPLATE="/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
TARGET="/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"

mkdir -p "$TARGET/src/pages/admin/products/categories"
mkdir -p "$TARGET/src/pages/admin/coupons"
mkdir -p "$TARGET/src/pages/admin/gift-cards"
mkdir -p "$TARGET/src/pages/admin/shipping"

cp "$TEMPLATE/src/pages/admin/products/index.astro" "$TARGET/src/pages/admin/products/index.astro"
cp "$TEMPLATE/src/pages/admin/products/categories/index.astro" "$TARGET/src/pages/admin/products/categories/index.astro"
cp "$TEMPLATE/src/pages/admin/products/categories/[id].astro" "$TARGET/src/pages/admin/products/categories/[id].astro"
cp "$TEMPLATE/src/pages/admin/products/[id].astro" "$TARGET/src/pages/admin/products/[id].astro"
cp "$TEMPLATE/src/pages/admin/coupons/index.astro" "$TARGET/src/pages/admin/coupons/index.astro"
cp "$TEMPLATE/src/pages/admin/coupons/[id].astro" "$TARGET/src/pages/admin/coupons/[id].astro"
cp "$TEMPLATE/src/pages/admin/gift-cards/index.astro" "$TARGET/src/pages/admin/gift-cards/index.astro"
cp "$TEMPLATE/src/pages/admin/gift-cards/[id].astro" "$TARGET/src/pages/admin/gift-cards/[id].astro"
cp "$TEMPLATE/src/pages/admin/shipping/index.astro" "$TARGET/src/pages/admin/shipping/index.astro"
cp "$TEMPLATE/src/pages/admin/shipping/[id].astro" "$TARGET/src/pages/admin/shipping/[id].astro"
```

- [ ] **Step 2: Commit nel target**

```bash
cd "/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"
git add src/pages/admin/products/ \
        src/pages/admin/coupons/ \
        src/pages/admin/gift-cards/ \
        src/pages/admin/shipping/
git commit -m "feat(admin): sync Products & Commerce pages from template"
```

---

## Checklist finale Piano 3

- [ ] `/admin/products` carica lista con DataTable
- [ ] `/admin/products/categories` carica lista categorie
- [ ] `/admin/products/categories/{id}` mostra form editabile con save
- [ ] `/admin/products/{id}` mostra dettaglio + varianti table + mini-form stato
- [ ] `/admin/coupons` carica lista con badge stati
- [ ] `/admin/coupons/{id}` mostra form editabile con save
- [ ] `/admin/gift-cards` carica lista con scadenza colorata
- [ ] `/admin/gift-cards/{id}` mostra KPI + storico utilizzi
- [ ] `/admin/shipping` carica lista zone
- [ ] `/admin/shipping/{id}` mostra form con select multiplo paesi
- [ ] Entrambi i repo sincronizzati e committati
