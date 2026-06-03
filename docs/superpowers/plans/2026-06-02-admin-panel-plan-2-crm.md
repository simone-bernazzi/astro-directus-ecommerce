# Admin Panel — Piano 2: CRM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare le pagine CRM del pannello admin: lista e dettaglio contatti, lista e dettaglio ordini, lista e dettaglio contact submissions con funzione "converti in contatto".

**Architecture:** Pagine Astro SSR con `prerender = false`. Ogni pagina usa `AdminLayout` e `DataTable`. Le pagine di dettaglio usano `SectionCard` per le sezioni impilate. Tutti i dati via Directus REST API con token JWT dal cookie `admin_token`.

**Tech Stack:** Astro SSR, DataTable (già implementato), AdminLayout (già implementato), Directus REST API

**Spec di riferimento:** `docs/superpowers/specs/2026-06-02-admin-panel-design.md`

**Prerequisito:** Piano 1 completato (`src/middleware.ts`, `src/layouts/AdminLayout.astro`, `src/components/admin/DataTable.astro` esistono).

---

## File Structure

```
src/
  components/
    admin/
      SectionCard.astro            ← NUOVO: card sezione riutilizzabile per detail pages
  pages/
    admin/
      contacts/
        index.astro                ← NUOVO: lista contatti con DataTable
        [id].astro                 ← NUOVO: dettaglio contatto (sezioni impilate)
      orders/
        index.astro                ← NUOVO: lista ordini con DataTable
        [id].astro                 ← NUOVO: dettaglio ordine (sezioni impilate)
      contact-submissions/
        index.astro                ← NUOVO: lista submissions contatto
        [id].astro                 ← NUOVO: dettaglio submission + converti
    api/
      admin/
        contacts/
          from-submission.ts       ← NUOVO: POST API — crea contatto da submission
```

---

## Costanti e badge helper (usati in più file)

Includi questo helper nelle pagine che mostrano badge colorati:

```typescript
// Badge HTML per pipeline stage
const PIPELINE_LABELS: Record<string, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  cliente_attivo: 'Attivo',
  cliente_fidelizzato: 'Fidelizzato',
  inattivo: 'Inattivo',
}
const PIPELINE_COLORS: Record<string, string> = {
  lead: 'background:#fff7ed;color:#f97316',
  prospect: 'background:#fef9c3;color:#ca8a04',
  cliente_attivo: 'background:#f0fdf4;color:#22c55e',
  cliente_fidelizzato: 'background:#eff6ff;color:#3b82f6',
  inattivo: 'background:#f3f4f6;color:#6b7280',
}

function pipelineBadge(stage: string) {
  const style = PIPELINE_COLORS[stage] ?? 'background:#f3f4f6;color:#6b7280'
  const label = PIPELINE_LABELS[stage] ?? stage
  return `<span style="${style};padding:2px 8px;border-radius:10px;font-size:12px;white-space:nowrap">${label}</span>`
}

// Badge per order status
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa', paid: 'Pagato', shipped: 'Spedito',
  delivered: 'Consegnato', refunded: 'Rimborsato',
}
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'background:#fef9c3;color:#ca8a04',
  paid: 'background:#eff6ff;color:#3b82f6',
  shipped: 'background:#fdf4ff;color:#a855f7',
  delivered: 'background:#f0fdf4;color:#22c55e',
  refunded: 'background:#f3f4f6;color:#6b7280',
}

function orderStatusBadge(status: string) {
  const style = ORDER_STATUS_COLORS[status] ?? 'background:#f3f4f6;color:#6b7280'
  const label = ORDER_STATUS_LABELS[status] ?? status
  return `<span style="${style};padding:2px 8px;border-radius:10px;font-size:12px">${label}</span>`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtEur(n: number | null) {
  if (n == null) return '—'
  return `€${n.toFixed(2)}`
}
```

---

## Task 1: SectionCard component

**Files:**
- Create: `src/components/admin/SectionCard.astro`

> **Contesto:** Componente riutilizzabile per le pagine di dettaglio. Ogni "sezione" (KPI, anagrafica, ordini, note CRM...) è un SectionCard con titolo e slot per il contenuto.

- [ ] **Step 1: Creare `src/components/admin/SectionCard.astro`**

```astro
---
// src/components/admin/SectionCard.astro
interface Props {
  title?: string
  class?: string
}
const { title, class: className = '' } = Astro.props
---

<div class:list={['sc', className]}>
  {title && <div class="sc-title">{title}</div>}
  <div class="sc-body"><slot /></div>
</div>

<style>
  .sc {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  .sc-title {
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  .sc-body {
    padding: 16px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
git add src/components/admin/SectionCard.astro
git commit -m "feat(admin): add SectionCard component for detail pages"
```

---

## Task 2: Contacts list page

**Files:**
- Create: `src/pages/admin/contacts/index.astro`

> **Contesto:** Pagina lista contatti. Usa `DataTable` con colonne: Nome, Email, Telefono, Pipeline, Canale, Data iscrizione. Paginazione server-side con `?page=N`. 25 record per pagina.

- [ ] **Step 1: Creare la directory e il file**

```astro
---
// src/pages/admin/contacts/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const PAGE_SIZE = 25
const page = Math.max(1, parseInt(Astro.url.searchParams.get('page') ?? '1'))
const offset = (page - 1) * PAGE_SIZE

const PIPELINE_LABELS: Record<string, string> = {
  lead: 'Lead', prospect: 'Prospect', cliente_attivo: 'Attivo',
  cliente_fidelizzato: 'Fidelizzato', inattivo: 'Inattivo',
}
const PIPELINE_COLORS: Record<string, string> = {
  lead: 'background:#fff7ed;color:#f97316',
  prospect: 'background:#fef9c3;color:#ca8a04',
  cliente_attivo: 'background:#f0fdf4;color:#22c55e',
  cliente_fidelizzato: 'background:#eff6ff;color:#3b82f6',
  inattivo: 'background:#f3f4f6;color:#6b7280',
}

function pipelineBadge(stage: string) {
  const style = PIPELINE_COLORS[stage] ?? 'background:#f3f4f6;color:#6b7280'
  return `<span style="${style};padding:2px 8px;border-radius:10px;font-size:12px">${PIPELINE_LABELS[stage] ?? stage}</span>`
}

const [listRes, countRes] = await Promise.all([
  dFetch(`/items/contacts?fields[]=id,first_name,last_name,email,phone,pipeline_stage,canale_prevalente,date_created&sort[]=-date_created&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/contacts?aggregate[count]=id'),
])

type ContactRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  pipeline_stage: string
  canale_prevalente: string
  date_created: string
}

const contacts = (listRes?.data ?? []) as ContactRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  {
    key: 'first_name',
    label: 'Nome',
    format: (_, row) => {
      const r = row as ContactRow
      return `<span style="font-weight:500;color:#111827">${r.first_name} ${r.last_name}</span>`
    },
  },
  { key: 'email', label: 'Email', format: (v) => String(v ?? '—') },
  { key: 'phone', label: 'Telefono', format: (v) => String(v ?? '—') },
  {
    key: 'pipeline_stage',
    label: 'Pipeline',
    format: (v) => pipelineBadge(String(v ?? '')),
  },
  {
    key: 'canale_prevalente',
    label: 'Canale',
    format: (v) => `<span style="color:#6b7280;font-size:13px">${String(v ?? '—')}</span>`,
  },
  {
    key: 'date_created',
    label: 'Iscritto',
    format: (v) => {
      if (!v) return '—'
      return new Date(String(v)).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
    },
  },
]
---

<AdminLayout title="Contatti" active="contacts">
  <DataTable
    columns={columns}
    rows={contacts as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/contacts/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessun contatto trovato."
  />
</AdminLayout>
```

- [ ] **Step 2: Verificare TypeScript**

```bash
cd "/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
npx tsc --noEmit
```
Expected: zero nuovi errori.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/contacts/index.astro
git commit -m "feat(admin): add contacts list page"
```

---

## Task 3: Contact detail page

**Files:**
- Create: `src/pages/admin/contacts/[id].astro`

> **Contesto:** Pagina dettaglio contatto con sezioni impilate. Fetcha in parallelo: contatto, ordini collegati, interazioni CRM, task CRM, KPI cliente. Usa `SectionCard` per ogni sezione.

- [ ] **Step 1: Creare `src/pages/admin/contacts/[id].astro`**

```astro
---
// src/pages/admin/contacts/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { Contact, Order, CrmInteraction, CrmTask, CustomerKpi } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/contacts')

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

async function dFetch(path: string) {
  try {
    const res = await fetch(`${directusUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const [contactRes, ordersRes, interactionsRes, tasksRes, kpiRes] = await Promise.all([
  dFetch(`/items/contacts/${id}?fields[]=*`),
  dFetch(`/items/orders?filter[contact_id][_eq]=${id}&fields[]=id,status,total,date_created,channel&sort[]=-date_created&limit=20`),
  dFetch(`/items/crm_interactions?filter[contact_id][_eq]=${id}&fields[]=id,type,date,subject,body&sort[]=-date&limit=20`),
  dFetch(`/items/crm_tasks?filter[contact_id][_eq]=${id}&fields[]=id,title,due_date,status,priority&sort[]=due_date&limit=20`),
  dFetch(`/items/customer_kpis?filter[contact_id][_eq]=${id}&limit=1`),
])

if (!contactRes?.data) return Astro.redirect('/admin/contacts')

const contact = contactRes.data as Contact
const orders = (ordersRes?.data ?? []) as Partial<Order>[]
const interactions = (interactionsRes?.data ?? []) as Partial<CrmInteraction>[]
const tasks = (tasksRes?.data ?? []) as Partial<CrmTask>[]
const kpi = (kpiRes?.data?.[0] ?? null) as Partial<CustomerKpi> | null

const fullName = `${contact.first_name} ${contact.last_name}`

const PIPELINE_LABELS: Record<string, string> = {
  lead: 'Lead', prospect: 'Prospect', cliente_attivo: 'Attivo',
  cliente_fidelizzato: 'Fidelizzato', inattivo: 'Inattivo',
}
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa', paid: 'Pagato', shipped: 'Spedito',
  delivered: 'Consegnato', refunded: 'Rimborsato',
}
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'background:#fef9c3;color:#ca8a04',
  paid: 'background:#eff6ff;color:#3b82f6',
  shipped: 'background:#fdf4ff;color:#a855f7',
  delivered: 'background:#f0fdf4;color:#22c55e',
  refunded: 'background:#f3f4f6;color:#6b7280',
}
const TASK_PRIORITY_COLORS: Record<string, string> = {
  high: 'color:#dc2626', medium: 'color:#f97316', low: 'color:#6b7280',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
---

<AdminLayout title={fullName} active="contacts">
  <!-- Header -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/contacts" style="color:#6b7280;text-decoration:none;font-size:13px">← Contatti</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">{fullName}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${
      contact.pipeline_stage === 'cliente_attivo' ? 'background:#f0fdf4;color:#22c55e' :
      contact.pipeline_stage === 'lead' ? 'background:#fff7ed;color:#f97316' :
      'background:#f3f4f6;color:#6b7280'
    }`}>{PIPELINE_LABELS[contact.pipeline_stage] ?? contact.pipeline_stage}</span>
  </div>

  <div style="display:flex;flex-direction:column;gap:16px">

    <!-- KPI bar -->
    {kpi && (
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        <SectionCard>
          <div style="text-align:center">
            <div style="font-size:22px;font-weight:700;color:#111827">€{(kpi.clv ?? 0).toFixed(0)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">Valore cliente</div>
          </div>
        </SectionCard>
        <SectionCard>
          <div style="text-align:center">
            <div style="font-size:22px;font-weight:700;color:#111827">{(kpi.total_orders_online ?? 0) + (kpi.total_orders_offline ?? 0)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">Ordini totali</div>
          </div>
        </SectionCard>
        <SectionCard>
          <div style="text-align:center">
            <div style="font-size:22px;font-weight:700;color:#111827">€{((kpi.total_spent_online ?? 0) + (kpi.total_spent_offline ?? 0)).toFixed(0)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">Totale speso</div>
          </div>
        </SectionCard>
        <SectionCard>
          <div style="text-align:center">
            <div style="font-size:22px;font-weight:700;color:#111827">{fmtDate(kpi.last_purchase_at)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">Ultimo acquisto</div>
          </div>
        </SectionCard>
      </div>
    )}

    <!-- Anagrafica -->
    <SectionCard title="Anagrafica">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px">
        <div><span style="color:#6b7280">Email:</span> {contact.email ?? '—'}</div>
        <div><span style="color:#6b7280">Telefono:</span> {contact.phone ?? '—'}</div>
        <div><span style="color:#6b7280">Data nascita:</span> {fmtDate(contact.date_of_birth)}</div>
        <div><span style="color:#6b7280">Canale:</span> {contact.canale_prevalente}</div>
        <div><span style="color:#6b7280">Stripe ID:</span> <code style="font-size:12px;color:#6b7280">{contact.stripe_customer_id ?? '—'}</code></div>
        <div><span style="color:#6b7280">Attivo:</span> {contact.is_active ? 'Sì' : 'No'}</div>
        <div><span style="color:#6b7280">Iscritto:</span> {fmtDate(contact.date_created)}</div>
      </div>
    </SectionCard>

    <!-- Ordini -->
    <SectionCard title={`Ordini (${orders.length})`}>
      {orders.length === 0
        ? <p style="color:#9ca3af;font-size:14px">Nessun ordine.</p>
        : (
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="border-bottom:1px solid #e5e7eb">
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">ID</th>
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Stato</th>
                <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Totale</th>
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Data</th>
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Canale</th>
                <th style="padding:6px 8px"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr style="border-bottom:1px solid #f3f4f6">
                  <td style="padding:8px;font-family:monospace;font-size:12px;color:#6b7280">{String(o.id ?? '').slice(0, 8)}…</td>
                  <td style="padding:8px">
                    <span style={`${ORDER_STATUS_COLORS[o.status ?? ''] ?? 'background:#f3f4f6;color:#6b7280'};padding:2px 8px;border-radius:10px;font-size:12px`}>
                      {ORDER_STATUS_LABELS[o.status ?? ''] ?? o.status}
                    </span>
                  </td>
                  <td style="padding:8px;text-align:right;font-weight:500">€{(o.total ?? 0).toFixed(2)}</td>
                  <td style="padding:8px;color:#6b7280">{fmtDate(o.date_created)}</td>
                  <td style="padding:8px;color:#6b7280">{o.channel ?? '—'}</td>
                  <td style="padding:8px"><a href={`/admin/orders/${o.id}`} style="color:#9ca3af;text-decoration:none">→</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </SectionCard>

    <!-- Note CRM (Interazioni) -->
    <SectionCard title={`Note CRM (${interactions.length})`}>
      {interactions.length === 0
        ? <p style="color:#9ca3af;font-size:14px">Nessuna interazione.</p>
        : (
          <div style="display:flex;flex-direction:column;gap:8px">
            {interactions.map(i => (
              <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px">
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
                  <span style="font-size:12px;font-weight:600;color:#374151;text-transform:uppercase">{i.type}</span>
                  <span style="color:#9ca3af;font-size:12px">{fmtDate(i.date)}</span>
                  {i.subject && <span style="font-size:13px;color:#111827;font-weight:500">{i.subject}</span>}
                </div>
                <p style="font-size:13px;color:#6b7280;margin:0">{i.body}</p>
              </div>
            ))}
          </div>
        )
      }
    </SectionCard>

    <!-- Task -->
    <SectionCard title={`Task (${tasks.length})`}>
      {tasks.length === 0
        ? <p style="color:#9ca3af;font-size:14px">Nessun task.</p>
        : (
          <div style="display:flex;flex-direction:column;gap:6px">
            {tasks.map(t => (
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6">
                <span style={`font-size:11px;font-weight:700;${TASK_PRIORITY_COLORS[t.priority ?? ''] ?? 'color:#6b7280'}`}>
                  {(t.priority ?? '').toUpperCase()}
                </span>
                <span style="flex:1;font-size:14px;color:#111827">{t.title}</span>
                <span style="font-size:12px;color:#6b7280">{fmtDate(t.due_date)}</span>
                <span style={`font-size:12px;padding:1px 6px;border-radius:8px;${
                  t.status === 'done' ? 'background:#f0fdf4;color:#22c55e' :
                  t.status === 'in_progress' ? 'background:#eff6ff;color:#3b82f6' :
                  'background:#f3f4f6;color:#6b7280'
                }`}>{t.status}</span>
              </div>
            ))}
          </div>
        )
      }
    </SectionCard>

  </div>
</AdminLayout>
```

- [ ] **Step 2: Verificare TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/contacts/
git commit -m "feat(admin): add contact detail page with stacked sections"
```

---

## Task 4: Orders list page

**Files:**
- Create: `src/pages/admin/orders/index.astro`

- [ ] **Step 1: Creare `src/pages/admin/orders/index.astro`**

```astro
---
// src/pages/admin/orders/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'

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

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa', paid: 'Pagato', shipped: 'Spedito',
  delivered: 'Consegnato', refunded: 'Rimborsato',
}
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'background:#fef9c3;color:#ca8a04',
  paid: 'background:#eff6ff;color:#3b82f6',
  shipped: 'background:#fdf4ff;color:#a855f7',
  delivered: 'background:#f0fdf4;color:#22c55e',
  refunded: 'background:#f3f4f6;color:#6b7280',
}

const [listRes, countRes] = await Promise.all([
  dFetch(`/items/orders?fields[]=id,customer_name,customer_email,total,status,date_created,channel,contact_id&sort[]=-date_created&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/orders?aggregate[count]=id'),
])

type OrderRow = {
  id: string
  customer_name: string
  customer_email: string
  total: number
  status: string
  date_created: string
  channel: string
  contact_id: string | null
}

const orders = (listRes?.data ?? []) as OrderRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

const columns: Column[] = [
  {
    key: 'id',
    label: 'ID',
    format: (v) => `<span style="font-family:monospace;font-size:12px;color:#6b7280">#${String(v).slice(0, 8)}</span>`,
  },
  { key: 'customer_name', label: 'Cliente', format: (v) => `<span style="font-weight:500">${String(v ?? '—')}</span>` },
  { key: 'customer_email', label: 'Email' },
  {
    key: 'total',
    label: 'Totale',
    format: (v) => `<span style="font-weight:500">€${Number(v ?? 0).toFixed(2)}</span>`,
  },
  {
    key: 'status',
    label: 'Stato',
    format: (v) => {
      const s = String(v ?? '')
      const style = ORDER_STATUS_COLORS[s] ?? 'background:#f3f4f6;color:#6b7280'
      return `<span style="${style};padding:2px 8px;border-radius:10px;font-size:12px">${ORDER_STATUS_LABELS[s] ?? s}</span>`
    },
  },
  {
    key: 'date_created',
    label: 'Data',
    format: (v) => v ? new Date(String(v)).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—',
  },
  { key: 'channel', label: 'Canale', format: (v) => `<span style="color:#6b7280;font-size:13px">${String(v ?? '—')}</span>` },
]
---

<AdminLayout title="Ordini" active="orders">
  <DataTable
    columns={columns}
    rows={orders as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/orders/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessun ordine trovato."
  />
</AdminLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/orders/index.astro
git commit -m "feat(admin): add orders list page"
```

---

## Task 5: Order detail page

**Files:**
- Create: `src/pages/admin/orders/[id].astro`

- [ ] **Step 1: Creare `src/pages/admin/orders/[id].astro`**

```astro
---
// src/pages/admin/orders/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'
import type { Order } from '@/lib/types'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/orders')

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

const orderRes = await dFetch(`/items/orders/${id}?fields[]=*,order_items.*`)
if (!orderRes?.data) return Astro.redirect('/admin/orders')

const order = orderRes.data as Order

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa', paid: 'Pagato', shipped: 'Spedito',
  delivered: 'Consegnato', refunded: 'Rimborsato',
}
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'background:#fef9c3;color:#ca8a04',
  paid: 'background:#eff6ff;color:#3b82f6',
  shipped: 'background:#fdf4ff;color:#a855f7',
  delivered: 'background:#f0fdf4;color:#22c55e',
  refunded: 'background:#f3f4f6;color:#6b7280',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const statusStyle = ORDER_STATUS_COLORS[order.status] ?? 'background:#f3f4f6;color:#6b7280'
---

<AdminLayout title={`Ordine #${order.id.slice(0, 8)}`} active="orders">

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/orders" style="color:#6b7280;text-decoration:none;font-size:13px">← Ordini</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827;font-family:monospace">#{order.id.slice(0, 8)}</h1>
    <span style={`padding:3px 10px;border-radius:10px;font-size:12px;${statusStyle}`}>
      {ORDER_STATUS_LABELS[order.status] ?? order.status}
    </span>
    <span style="margin-left:auto;font-size:13px;color:#6b7280">{fmtDate(order.date_created)}</span>
  </div>

  <div style="display:flex;flex-direction:column;gap:16px">

    <!-- Info ordine -->
    <SectionCard title="Informazioni ordine">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px">
        <div><span style="color:#6b7280">Cliente:</span> <strong>{order.customer_name}</strong></div>
        <div><span style="color:#6b7280">Email:</span> {order.customer_email}</div>
        <div><span style="color:#6b7280">Canale:</span> {order.channel}</div>
        <div><span style="color:#6b7280">Stripe session:</span> <code style="font-size:11px;color:#6b7280">{order.stripe_session_id}</code></div>
        {order.notes && <div style="grid-column:span 2"><span style="color:#6b7280">Note:</span> {order.notes}</div>}
        {order.tracking_number && (
          <div style="grid-column:span 2">
            <span style="color:#6b7280">Tracking:</span>
            {order.tracking_url
              ? <a href={order.tracking_url} target="_blank" rel="noopener" style="color:#3b82f6">{order.tracking_number}</a>
              : order.tracking_number
            }
          </div>
        )}
      </div>
    </SectionCard>

    <!-- Prodotti ordinati -->
    <SectionCard title={`Prodotti (${order.order_items?.length ?? 0})`}>
      {!order.order_items?.length
        ? <p style="color:#9ca3af;font-size:14px">Nessun prodotto.</p>
        : (
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="border-bottom:1px solid #e5e7eb">
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Prodotto</th>
                <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">SKU</th>
                <th style="text-align:center;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Qtà</th>
                <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Prezzo</th>
                <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase">Totale</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map(item => (
                <tr style="border-bottom:1px solid #f3f4f6">
                  <td style="padding:8px">
                    <div style="font-weight:500">{item.product_name}</div>
                    <div style="font-size:12px;color:#6b7280">{item.variant_name}</div>
                  </td>
                  <td style="padding:8px;font-family:monospace;font-size:12px;color:#6b7280">{item.sku}</td>
                  <td style="padding:8px;text-align:center">{item.quantity}</td>
                  <td style="padding:8px;text-align:right">€{item.unit_price.toFixed(2)}</td>
                  <td style="padding:8px;text-align:right;font-weight:500">€{(item.unit_price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </SectionCard>

    <!-- Spedizione -->
    <SectionCard title="Spedizione">
      {order.shipping_address
        ? (
          <div style="font-size:14px;line-height:1.6">
            <p style="font-weight:500">{order.shipping_address.name}</p>
            <p style="color:#6b7280">{order.shipping_address.line1}{order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ''}</p>
            <p style="color:#6b7280">{order.shipping_address.postal_code} {order.shipping_address.city} ({order.shipping_address.state}), {order.shipping_address.country}</p>
          </div>
        )
        : <p style="color:#9ca3af;font-size:14px">Nessun indirizzo di spedizione.</p>
      }
    </SectionCard>

    <!-- Riepilogo pagamento -->
    <SectionCard title="Pagamento">
      <div style="display:flex;flex-direction:column;gap:6px;font-size:14px;max-width:300px">
        <div style="display:flex;justify-content:space-between">
          <span style="color:#6b7280">Subtotale</span>
          <span>€{order.subtotal.toFixed(2)}</span>
        </div>
        {order.discount_amount > 0 && (
          <div style="display:flex;justify-content:space-between;color:#22c55e">
            <span>Sconto</span>
            <span>-€{order.discount_amount.toFixed(2)}</span>
          </div>
        )}
        {(order.gift_card_amount_used ?? 0) > 0 && (
          <div style="display:flex;justify-content:space-between;color:#22c55e">
            <span>Gift card</span>
            <span>-€{(order.gift_card_amount_used ?? 0).toFixed(2)}</span>
          </div>
        )}
        <div style="display:flex;justify-content:space-between">
          <span style="color:#6b7280">Spedizione</span>
          <span>€{order.shipping_cost.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:4px">
          <span>Totale</span>
          <span>€{order.total.toFixed(2)}</span>
        </div>
      </div>
    </SectionCard>

  </div>
</AdminLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/orders/[id].astro
git commit -m "feat(admin): add order detail page with stacked sections"
```

---

## Task 6: Contact submissions list

**Files:**
- Create: `src/pages/admin/contact-submissions/index.astro`

> **Contesto:** Lista delle form submissions filtrate per il form con slug `contact`. Mostra: nome, email (estratti da `data`), messaggio troncato, data, stato letto/non letto.

- [ ] **Step 1: Creare `src/pages/admin/contact-submissions/index.astro`**

```astro
---
// src/pages/admin/contact-submissions/index.astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import DataTable from '@/components/admin/DataTable.astro'
import type { Column } from '@/components/admin/DataTable.astro'

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

// Filtra per form.slug = 'contact' usando deep filter Directus
const [listRes, countRes] = await Promise.all([
  dFetch(`/items/form_submissions?filter[form_id][slug][_eq]=contact&fields[]=id,data,date_created,is_read&sort[]=-date_created&limit=${PAGE_SIZE}&offset=${offset}`),
  dFetch('/items/form_submissions?filter[form_id][slug][_eq]=contact&aggregate[count]=id'),
])

type SubmissionRow = {
  id: string
  data: Record<string, unknown>
  date_created: string
  is_read: boolean
}

const submissions = (listRes?.data ?? []) as SubmissionRow[]
const total = parseInt(countRes?.data?.[0]?.count?.id ?? '0')

// Estrae nome/email dai campi comuni usati nei form
function extractName(data: Record<string, unknown>): string {
  return String(data.name ?? data.nome ?? data.first_name ?? '—')
}
function extractEmail(data: Record<string, unknown>): string {
  return String(data.email ?? '—')
}
function extractMessage(data: Record<string, unknown>): string {
  const msg = String(data.message ?? data.messaggio ?? data.body ?? data.testo ?? '')
  return msg.length > 80 ? msg.slice(0, 80) + '…' : msg || '—'
}

const columns: Column[] = [
  {
    key: 'data',
    label: 'Nome',
    format: (v) => `<span style="font-weight:500">${extractName(v as Record<string, unknown>)}</span>`,
  },
  {
    key: 'data',
    label: 'Email',
    format: (v) => extractEmail(v as Record<string, unknown>),
  },
  {
    key: 'data',
    label: 'Messaggio',
    format: (v) => `<span style="color:#6b7280;font-size:13px">${extractMessage(v as Record<string, unknown>)}</span>`,
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

<AdminLayout title="Submissions contatto" active="forms">
  <DataTable
    columns={columns}
    rows={submissions as unknown as Record<string, unknown>[]}
    idField="id"
    detailBase="/admin/contact-submissions/"
    page={page}
    total={total}
    pageSize={PAGE_SIZE}
    emptyMessage="Nessuna submission trovata."
  />
</AdminLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/contact-submissions/index.astro
git commit -m "feat(admin): add contact submissions list page"
```

---

## Task 7: Submission detail + API converti in contatto

**Files:**
- Create: `src/pages/admin/contact-submissions/[id].astro`
- Create: `src/pages/api/admin/contacts/from-submission.ts`

> **Contesto:** Pagina dettaglio submission read-only. Il pulsante "Converti in contatto" chiama `POST /api/admin/contacts/from-submission` che: legge la submission, estrae nome/email/phone, crea un record in `contacts`, marca la submission come letta, restituisce `{contact_id}`.

- [ ] **Step 1: Creare `src/pages/api/admin/contacts/from-submission.ts`**

```typescript
// src/pages/api/admin/contacts/from-submission.ts
export const prerender = false

import type { APIRoute } from 'astro'

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? ''

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('admin_token')?.value
  if (!token) return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 401 })

  let body: { submission_id?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Richiesta non valida' }), { status: 400 })
  }
  if (!body.submission_id) {
    return new Response(JSON.stringify({ error: 'submission_id obbligatorio' }), { status: 400 })
  }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 1. Legge la submission
  let submissionRes: Response
  try {
    submissionRes = await fetch(`${DIRECTUS_URL}/items/form_submissions/${body.submission_id}?fields[]=id,data,is_read`, { headers })
  } catch {
    return new Response(JSON.stringify({ error: 'Servizio non raggiungibile' }), { status: 503 })
  }
  if (!submissionRes.ok) return new Response(JSON.stringify({ error: 'Submission non trovata' }), { status: 404 })

  const { data: submission } = await submissionRes.json() as { data: { id: string; data: Record<string, unknown>; is_read: boolean } }
  const fields = submission.data

  // 2. Estrae nome/email/phone dai campi comuni
  const rawName = String(fields.name ?? fields.nome ?? fields.first_name ?? '')
  const nameParts = rawName.trim().split(/\s+/)
  const first_name = nameParts[0] ?? 'Contatto'
  const last_name = nameParts.slice(1).join(' ') || 'Submission'
  const email = fields.email ? String(fields.email) : null
  const phone = fields.phone ?? fields.telefono ?? fields.tel ? String(fields.phone ?? fields.telefono ?? fields.tel) : null

  // 3. Crea il contatto
  let contactRes: Response
  try {
    contactRes = await fetch(`${DIRECTUS_URL}/items/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        first_name,
        last_name,
        email,
        phone,
        pipeline_stage: 'lead',
        canale_prevalente: 'online',
        channel_type: 'online',
        is_active: true,
      }),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Errore creazione contatto' }), { status: 503 })
  }
  if (!contactRes.ok) {
    const err = await contactRes.json().catch(() => ({}))
    return new Response(JSON.stringify({ error: 'Errore creazione contatto', details: err }), { status: 500 })
  }

  const { data: newContact } = await contactRes.json() as { data: { id: string } }

  // 4. Marca la submission come letta
  try {
    await fetch(`${DIRECTUS_URL}/items/form_submissions/${body.submission_id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_read: true }),
    })
  } catch { /* non bloccante */ }

  return new Response(JSON.stringify({ contact_id: newContact.id }), { status: 200 })
}
```

- [ ] **Step 2: Creare `src/pages/admin/contact-submissions/[id].astro`**

```astro
---
// src/pages/admin/contact-submissions/[id].astro
export const prerender = false

import AdminLayout from '@/layouts/AdminLayout.astro'
import SectionCard from '@/components/admin/SectionCard.astro'

const { id } = Astro.params
if (!id) return Astro.redirect('/admin/contact-submissions')

const directusUrl = process.env.DIRECTUS_URL ?? ''
const token = Astro.cookies.get('admin_token')?.value ?? ''

let submissionRes: Response | null = null
try {
  submissionRes = await fetch(`${directusUrl}/items/form_submissions/${id}?fields[]=*`, {
    headers: { Authorization: `Bearer ${token}` },
  })
} catch {}

if (!submissionRes?.ok) return Astro.redirect('/admin/contact-submissions')

const { data: submission } = await submissionRes.json() as {
  data: {
    id: string
    data: Record<string, unknown>
    date_created: string
    is_read: boolean
    ip_address: string | null
    page_url: string | null
  }
}

// Marca come letta se non lo era
if (!submission.is_read) {
  try {
    await fetch(`${directusUrl}/items/form_submissions/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
  } catch {}
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
---

<AdminLayout title="Submission contatto" active="forms">

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <a href="/admin/contact-submissions" style="color:#6b7280;text-decoration:none;font-size:13px">← Submissions</a>
    <span style="color:#d1d5db">/</span>
    <h1 style="font-size:18px;font-weight:700;color:#111827">Submission <code style="font-size:14px;color:#6b7280">#{submission.id.slice(0, 8)}</code></h1>
    <span style="margin-left:auto">
      <button
        id="convert-btn"
        type="button"
        style="background:#111827;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer"
      >
        + Converti in contatto
      </button>
    </span>
  </div>

  <p id="convert-msg" style="display:none;margin-bottom:12px;font-size:13px"></p>

  <div style="display:flex;flex-direction:column;gap:16px">

    <SectionCard title="Dati ricevuti">
      <dl style="display:grid;grid-template-columns:max-content 1fr;gap:8px 16px;font-size:14px">
        {Object.entries(submission.data).map(([key, value]) => (
          <>
            <dt style="color:#6b7280;font-weight:500">{key}</dt>
            <dd style="color:#111827;word-break:break-word">{String(value ?? '')}</dd>
          </>
        ))}
      </dl>
    </SectionCard>

    <SectionCard title="Metadati">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px">
        <div><span style="color:#6b7280">Data:</span> {fmtDate(submission.date_created)}</div>
        <div><span style="color:#6b7280">IP:</span> {submission.ip_address ?? '—'}</div>
        <div style="grid-column:span 2"><span style="color:#6b7280">Pagina:</span> {submission.page_url ?? '—'}</div>
      </div>
    </SectionCard>

  </div>
</AdminLayout>

<script define:vars={{ submissionId: id }}>
  const btn = document.getElementById('convert-btn')
  const msg = document.getElementById('convert-msg')

  btn?.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = 'Conversione in corso…'

    try {
      const res = await fetch('/api/admin/contacts/from-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId }),
      })
      const data = await res.json()

      if (res.ok && data.contact_id) {
        msg.textContent = '✓ Contatto creato. Reindirizzamento…'
        msg.style.color = '#22c55e'
        msg.style.display = 'block'
        setTimeout(() => { window.location.href = `/admin/contacts/${data.contact_id}` }, 1200)
      } else {
        msg.textContent = data.error ?? 'Errore durante la conversione.'
        msg.style.color = '#dc2626'
        msg.style.display = 'block'
        btn.disabled = false
        btn.textContent = '+ Converti in contatto'
      }
    } catch {
      msg.textContent = 'Errore di rete.'
      msg.style.color = '#dc2626'
      msg.style.display = 'block'
      btn.disabled = false
      btn.textContent = '+ Converti in contatto'
    }
  })
</script>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/contact-submissions/ src/pages/api/admin/contacts/
git commit -m "feat(admin): add submission detail page and from-submission API"
```

---

## Task 8: Sync ottica-marangon

**Files da copiare:**
- `src/components/admin/SectionCard.astro`
- `src/pages/admin/contacts/index.astro`
- `src/pages/admin/contacts/[id].astro`
- `src/pages/admin/orders/index.astro`
- `src/pages/admin/orders/[id].astro`
- `src/pages/admin/contact-submissions/index.astro`
- `src/pages/admin/contact-submissions/[id].astro`
- `src/pages/api/admin/contacts/from-submission.ts`

- [ ] **Step 1: Copiare i file**

```bash
TEMPLATE="/Users/simonebernazzi/Documents/Google Drive/Documenti/Progetti/directus-ecommerce-template"
TARGET="/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"

mkdir -p "$TARGET/src/pages/admin/contacts"
mkdir -p "$TARGET/src/pages/admin/orders"
mkdir -p "$TARGET/src/pages/admin/contact-submissions"
mkdir -p "$TARGET/src/pages/api/admin/contacts"

cp "$TEMPLATE/src/components/admin/SectionCard.astro" "$TARGET/src/components/admin/SectionCard.astro"
cp "$TEMPLATE/src/pages/admin/contacts/index.astro" "$TARGET/src/pages/admin/contacts/index.astro"
cp "$TEMPLATE/src/pages/admin/contacts/[id].astro" "$TARGET/src/pages/admin/contacts/[id].astro"
cp "$TEMPLATE/src/pages/admin/orders/index.astro" "$TARGET/src/pages/admin/orders/index.astro"
cp "$TEMPLATE/src/pages/admin/orders/[id].astro" "$TARGET/src/pages/admin/orders/[id].astro"
cp "$TEMPLATE/src/pages/admin/contact-submissions/index.astro" "$TARGET/src/pages/admin/contact-submissions/index.astro"
cp "$TEMPLATE/src/pages/admin/contact-submissions/[id].astro" "$TARGET/src/pages/admin/contact-submissions/[id].astro"
cp "$TEMPLATE/src/pages/api/admin/contacts/from-submission.ts" "$TARGET/src/pages/api/admin/contacts/from-submission.ts"
```

- [ ] **Step 2: Commit nel target**

```bash
cd "/Users/simonebernazzi/Siti directus/ottica-marangon-ecommerce/ottica-marangon-ecommerce"
git add src/components/admin/SectionCard.astro \
        src/pages/admin/contacts/ \
        src/pages/admin/orders/ \
        src/pages/admin/contact-submissions/ \
        src/pages/api/admin/contacts/
git commit -m "feat(admin): sync CRM pages from template — contacts, orders, contact-submissions"
```

---

## Checklist finale Piano 2

- [ ] `/admin/contacts` carica la lista con DataTable e paginazione
- [ ] `/admin/contacts/{id}` mostra KPI, anagrafica, ordini, interazioni CRM, task
- [ ] `/admin/orders` carica la lista con DataTable e paginazione
- [ ] `/admin/orders/{id}` mostra info ordine, prodotti, spedizione, pagamento
- [ ] `/admin/contact-submissions` mostra lista filtrata per form.slug='contact'
- [ ] `/admin/contact-submissions/{id}` mostra dati submission e pulsante converti
- [ ] Pulsante "Converti in contatto" crea contatto e redirige alla pagina contatto
- [ ] Entrambi i repo sincronizzati e committati
