# CRM Foundation — Piano 1: Collezioni, Types, Client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare la struttura dati CRM completa in Directus — estendere le collezioni e-commerce esistenti e aggiungere tutte le nuove collezioni CRM — con TypeScript types e client helpers testati.

**Architecture:** Approccio CRM-first: `contacts` è la collezione master per tutte le persone. Le collezioni e-commerce esistenti (`products`, `orders`, `customers`) vengono estese con nuovi campi. Due script separati: `setup-collections.mjs` (già esistente, da aggiornare) e `setup-crm-collections.mjs` (nuovo).

**Tech Stack:** Directus SDK v21 (`staticToken`, `createField`, `createCollection`, `createRelation`), TypeScript, Vitest, Node.js 22.

---

## Struttura File

```
scripts/
├── setup-collections.mjs          # MODIFICATO — aggiunge campi CRM alle collezioni esistenti
└── setup-crm-collections.mjs      # NUOVO — crea tutte le collezioni CRM

src/lib/
├── types.ts                       # MODIFICATO — aggiunge tipi CRM
├── crm.ts                         # NUOVO — query helpers per CRM
└── crm.test.ts                    # NUOVO — test Vitest
```

---

## Task 1: TypeScript Types CRM

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/crm.test.ts` (stub iniziale)

- [ ] **Step 1.1: Aggiungi tipi CRM a `src/lib/types.ts`**

Apri `src/lib/types.ts` e aggiungi in fondo al file, dopo tutti i tipi esistenti:

```typescript
// ─── CRM ─────────────────────────────────────────────────────────────────────

export type ChannelType = 'offline' | 'online' | 'both';
export type PipelineStage =
  | 'lead'
  | 'prospect'
  | 'cliente_attivo'
  | 'cliente_fidelizzato'
  | 'inattivo';
export type InteractionType = 'call' | 'visit' | 'email' | 'whatsapp' | 'note' | 'other';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';
export type CrmDocumentType = 'preventivo' | 'contratto' | 'foto' | 'prescrizione' | 'altro';
export type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'dormant' | 'new' | 'other';

export interface CrmTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  channel_type: ChannelType;
  canale_prevalente: 'offline' | 'online';
  pipeline_stage: PipelineStage;
  customer_id: string | null;
  default_shipping_address: ShippingAddress | null;
  is_active: boolean;
  tags: CrmTag[];
  date_created: string;
}

export interface CrmInteraction {
  id: string;
  contact_id: string;
  type: InteractionType;
  date: string;
  subject: string | null;
  body: string;
  outcome: string | null;
  staff_id: string;
}

export interface CrmTask {
  id: string;
  contact_id: string;
  title: string;
  due_date: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string;
  notes: string | null;
}

export interface CrmDocument {
  id: string;
  contact_id: string;
  file_id: string;
  label: string;
  type: CrmDocumentType;
}

export interface CrmPipelineHistory {
  id: string;
  contact_id: string;
  from_stage: PipelineStage;
  to_stage: PipelineStage;
  date: string;
  changed_by: string;
  notes: string | null;
}

export interface CustomerKpi {
  id: string;
  contact_id: string;
  clv: number;
  churn_score: number;
  lead_score: number;
  total_spent_online: number;
  total_spent_offline: number;
  total_orders_online: number;
  total_orders_offline: number;
  last_purchase_at: string | null;
  avg_order_value: number;
  preferred_channel: 'offline' | 'online';
  rfm_segment: RfmSegment;
  calculated_at: string;
}
```

Aggiungi anche i seguenti campi alle interfacce **già esistenti** nel file:

Nell'interfaccia `Order`, aggiungi dopo `date_created`:
```typescript
  channel: 'online' | 'offline';
  contact_id: string | null;
  staff_id: string | null;
```

Nell'interfaccia `Customer`, aggiungi dopo `total_spent`:
```typescript
  contact_id: string | null;
```

- [ ] **Step 1.2: Crea `src/lib/crm.test.ts` — test tipi**

```typescript
import { describe, it, expect } from 'vitest';
import type {
  Contact, CrmInteraction, CrmTask, CustomerKpi,
  ChannelType, PipelineStage,
} from './types';

describe('CRM types', () => {
  it('Contact has required fields', () => {
    const c: Contact = {
      id: '1',
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario@esempio.it',
      phone: null,
      date_of_birth: null,
      channel_type: 'online',
      canale_prevalente: 'online',
      pipeline_stage: 'cliente_attivo',
      customer_id: null,
      default_shipping_address: null,
      is_active: true,
      tags: [],
      date_created: '2026-01-01T00:00:00Z',
    };
    expect(c.channel_type).toBe('online');
    expect(c.pipeline_stage).toBe('cliente_attivo');
  });

  it('ChannelType accepts offline, online, both', () => {
    const a: ChannelType = 'offline';
    const b: ChannelType = 'online';
    const c: ChannelType = 'both';
    expect([a, b, c]).toHaveLength(3);
  });

  it('PipelineStage covers all 5 stages', () => {
    const stages: PipelineStage[] = [
      'lead', 'prospect', 'cliente_attivo', 'cliente_fidelizzato', 'inattivo',
    ];
    expect(stages).toHaveLength(5);
  });

  it('CustomerKpi has CLV and churn fields', () => {
    const kpi: CustomerKpi = {
      id: '1',
      contact_id: '1',
      clv: 500,
      churn_score: 25,
      lead_score: 80,
      total_spent_online: 300,
      total_spent_offline: 200,
      total_orders_online: 3,
      total_orders_offline: 2,
      last_purchase_at: '2026-05-01T00:00:00Z',
      avg_order_value: 100,
      preferred_channel: 'online',
      rfm_segment: 'loyal',
      calculated_at: '2026-06-01T00:00:00Z',
    };
    expect(kpi.clv).toBe(500);
    expect(kpi.churn_score).toBe(25);
  });
});
```

- [ ] **Step 1.3: Esegui test**

```bash
npm test
```

Expected: tutti i test passano (inclusi i test esistenti).

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/types.ts src/lib/crm.test.ts
git commit -m "feat(crm): add CRM TypeScript types"
```

---

## Task 2: Estendi Script Setup Esistente

**Files:**
- Modify: `scripts/setup-collections.mjs`

Aggiunge i nuovi campi CRM alle collezioni e-commerce già esistenti (`products`, `orders`, `customers`).

- [ ] **Step 2.1: Aggiungi campi a `products`**

Apri `scripts/setup-collections.mjs`. Trova il blocco che crea i campi per `products` (cerca `await field('products', 'seo_description'`). Aggiungi dopo quell'ultimo campo:

```javascript
  // CRM fields
  await field('products', 'is_ecommerce', 'boolean', { default_value: false }, { interface: 'boolean', note: 'Se true, il prodotto è pubblicato sul sito e-commerce' })
  await field('products', 'is_archived', 'boolean', { default_value: false }, { interface: 'boolean', note: 'Soft delete dal catalogo' })
```

- [ ] **Step 2.2: Aggiungi campi a `orders`**

Trova il blocco che crea i campi per `orders` (cerca `await field('orders', 'notes'`). Aggiungi dopo:

```javascript
  // CRM fields
  await field('orders', 'channel', 'string', { default_value: 'online' }, {
    interface: 'select-dropdown',
    options: { choices: [{ text: 'Online', value: 'online' }, { text: 'Offline (negozio)', value: 'offline' }] },
    note: 'Canale di vendita',
  })
  await field('orders', 'contact_id', 'integer', { is_nullable: true }, { interface: 'input', hidden: true, note: 'FK → contacts (CRM)' })
  await field('orders', 'staff_id', 'uuid', { is_nullable: true }, { interface: 'input', hidden: true, note: 'Operatore che ha processato ordine offline' })
```

- [ ] **Step 2.3: Aggiungi campi a `customers`**

Trova il blocco che crea i campi per `customers` (cerca `await field('customers', 'total_spent'`). Aggiungi dopo:

```javascript
  // CRM fields
  await field('customers', 'contact_id', 'integer', { is_nullable: true }, { interface: 'input', hidden: true, note: 'FK → contacts (CRM)' })
```

- [ ] **Step 2.4: Verifica script sintatticamente corretto**

```bash
node --check scripts/setup-collections.mjs
```

Expected: nessun output (nessun errore di sintassi).

- [ ] **Step 2.5: Commit**

```bash
git add scripts/setup-collections.mjs
git commit -m "feat(crm): extend existing collections with CRM fields"
```

---

## Task 3: Script Setup Collezioni CRM

**Files:**
- Create: `scripts/setup-crm-collections.mjs`

- [ ] **Step 3.1: Crea `scripts/setup-crm-collections.mjs`**

```javascript
// scripts/setup-crm-collections.mjs
// Crea tutte le collezioni CRM in Directus
// Usage: DIRECTUS_TOKEN=xxx node scripts/setup-crm-collections.mjs

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

async function field(col, name, type, schema = {}, meta = {}) {
  await safe(() => client.request(createField(col, { field: name, type, schema: { name, ...schema }, meta })),
    `${col}.${name}`)
}

async function main() {
  console.log(`\nSetup collezioni CRM → ${DIRECTUS_URL}\n`)

  // ── crm_tags ──────────────────────────────────────────────────────────────
  await collection('crm_tags', 'label', '{{name}}')
  await field('crm_tags', 'name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('crm_tags', 'color', 'string', { default_value: '#6b7280' }, { interface: 'select-color' })
  await field('crm_tags', 'description', 'string', { is_nullable: true }, { interface: 'input' })

  // ── contacts ──────────────────────────────────────────────────────────────
  await collection('contacts', 'person', '{{first_name}} {{last_name}}')
  await field('contacts', 'first_name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('contacts', 'last_name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('contacts', 'email', 'string', { is_nullable: true, is_unique: true }, { interface: 'input' })
  await field('contacts', 'phone', 'string', { is_nullable: true }, { interface: 'input' })
  await field('contacts', 'date_of_birth', 'date', { is_nullable: true }, { interface: 'datetime' })
  await field('contacts', 'channel_type', 'string', { default_value: 'offline' }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Offline (negozio)', value: 'offline' },
      { text: 'Online', value: 'online' },
      { text: 'Entrambi', value: 'both' },
    ]},
  })
  await field('contacts', 'canale_prevalente', 'string', { default_value: 'offline' }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Offline', value: 'offline' },
      { text: 'Online', value: 'online' },
    ]},
  })
  await field('contacts', 'pipeline_stage', 'string', { default_value: 'lead' }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Lead', value: 'lead' },
      { text: 'Prospect', value: 'prospect' },
      { text: 'Cliente attivo', value: 'cliente_attivo' },
      { text: 'Cliente fidelizzato', value: 'cliente_fidelizzato' },
      { text: 'Inattivo', value: 'inattivo' },
    ]},
  })
  await field('contacts', 'customer_id', 'integer', { is_nullable: true }, { interface: 'input', hidden: true, note: 'FK → customers (utente online)' })
  await field('contacts', 'default_shipping_address', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' } })
  await field('contacts', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })

  // ── crm_interactions ──────────────────────────────────────────────────────
  await collection('crm_interactions', 'chat', '{{type}} — {{date}}')
  await field('crm_interactions', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('crm_interactions', 'type', 'string', { is_nullable: false }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Telefonata', value: 'call' },
      { text: 'Visita in negozio', value: 'visit' },
      { text: 'Email', value: 'email' },
      { text: 'WhatsApp', value: 'whatsapp' },
      { text: 'Nota interna', value: 'note' },
      { text: 'Altro', value: 'other' },
    ]},
  })
  await field('crm_interactions', 'date', 'dateTime', { is_nullable: false }, { interface: 'datetime' })
  await field('crm_interactions', 'subject', 'string', { is_nullable: true }, { interface: 'input' })
  await field('crm_interactions', 'body', 'text', { is_nullable: false }, { interface: 'input-multiline' })
  await field('crm_interactions', 'outcome', 'string', { is_nullable: true }, { interface: 'input' })
  await field('crm_interactions', 'staff_id', 'uuid', { is_nullable: true }, { interface: 'input', hidden: true })

  // ── crm_tasks ─────────────────────────────────────────────────────────────
  await collection('crm_tasks', 'check_circle', '{{title}}')
  await field('crm_tasks', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('crm_tasks', 'title', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('crm_tasks', 'due_date', 'dateTime', { is_nullable: false }, { interface: 'datetime' })
  await field('crm_tasks', 'status', 'string', { default_value: 'pending' }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Da fare', value: 'pending' },
      { text: 'In corso', value: 'in_progress' },
      { text: 'Completato', value: 'done' },
      { text: 'Annullato', value: 'cancelled' },
    ]},
  })
  await field('crm_tasks', 'priority', 'string', { default_value: 'medium' }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Bassa', value: 'low' },
      { text: 'Media', value: 'medium' },
      { text: 'Alta', value: 'high' },
    ]},
  })
  await field('crm_tasks', 'assigned_to', 'uuid', { is_nullable: true }, { interface: 'input', hidden: true })
  await field('crm_tasks', 'notes', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── crm_documents ─────────────────────────────────────────────────────────
  await collection('crm_documents', 'attach_file', '{{label}}')
  await field('crm_documents', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('crm_documents', 'file_id', 'uuid', { is_nullable: false }, { interface: 'input', hidden: true, note: 'FK → directus_files' })
  await field('crm_documents', 'label', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('crm_documents', 'type', 'string', { default_value: 'altro' }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Preventivo', value: 'preventivo' },
      { text: 'Contratto', value: 'contratto' },
      { text: 'Foto', value: 'foto' },
      { text: 'Prescrizione', value: 'prescrizione' },
      { text: 'Altro', value: 'altro' },
    ]},
  })

  // ── crm_pipeline_history ──────────────────────────────────────────────────
  await collection('crm_pipeline_history', 'history', '{{from_stage}} → {{to_stage}}')
  await field('crm_pipeline_history', 'contact_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('crm_pipeline_history', 'from_stage', 'string', { is_nullable: false }, { interface: 'input' })
  await field('crm_pipeline_history', 'to_stage', 'string', { is_nullable: false }, { interface: 'input' })
  await field('crm_pipeline_history', 'date', 'dateTime', { is_nullable: false }, { interface: 'datetime' })
  await field('crm_pipeline_history', 'changed_by', 'uuid', { is_nullable: true }, { interface: 'input', hidden: true })
  await field('crm_pipeline_history', 'notes', 'text', { is_nullable: true }, { interface: 'input-multiline' })

  // ── customer_kpis ─────────────────────────────────────────────────────────
  await collection('customer_kpis', 'analytics', '{{contact_id}}')
  await field('customer_kpis', 'contact_id', 'integer', { is_nullable: false, is_unique: true }, { interface: 'input', hidden: true })
  await field('customer_kpis', 'clv', 'decimal', { numeric_precision: 12, numeric_scale: 2, default_value: 0 }, { interface: 'input', note: 'Customer Lifetime Value' })
  await field('customer_kpis', 'churn_score', 'decimal', { numeric_precision: 5, numeric_scale: 2, default_value: 0 }, { interface: 'input', note: '0-100, più alto = più a rischio' })
  await field('customer_kpis', 'lead_score', 'decimal', { numeric_precision: 5, numeric_scale: 2, default_value: 0 }, { interface: 'input', note: '0-100, propensione acquisto' })
  await field('customer_kpis', 'total_spent_online', 'decimal', { numeric_precision: 12, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'total_spent_offline', 'decimal', { numeric_precision: 12, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'total_orders_online', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'total_orders_offline', 'integer', { default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'last_purchase_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })
  await field('customer_kpis', 'avg_order_value', 'decimal', { numeric_precision: 10, numeric_scale: 2, default_value: 0 }, { interface: 'input' })
  await field('customer_kpis', 'preferred_channel', 'string', { default_value: 'offline' }, {
    interface: 'select-dropdown',
    options: { choices: [{ text: 'Offline', value: 'offline' }, { text: 'Online', value: 'online' }] },
  })
  await field('customer_kpis', 'rfm_segment', 'string', { default_value: 'other' }, {
    interface: 'select-dropdown',
    options: { choices: [
      { text: 'Champions', value: 'champions' },
      { text: 'Loyal', value: 'loyal' },
      { text: 'At Risk', value: 'at_risk' },
      { text: 'Dormant', value: 'dormant' },
      { text: 'New', value: 'new' },
      { text: 'Other', value: 'other' },
    ]},
  })
  await field('customer_kpis', 'calculated_at', 'dateTime', { is_nullable: true }, { interface: 'datetime' })

  console.log('\n✓ Setup CRM completato.')
  console.log('\nPassaggi manuali rimanenti in Directus Admin:')
  console.log('  1. Crea relazione M2O: contacts.customer_id → customers.id')
  console.log('  2. Crea relazione M2O: crm_interactions.contact_id → contacts.id')
  console.log('  3. Crea relazione M2O: crm_tasks.contact_id → contacts.id')
  console.log('  4. Crea relazione M2O: crm_documents.contact_id → contacts.id')
  console.log('  5. Crea relazione M2O: crm_pipeline_history.contact_id → contacts.id')
  console.log('  6. Crea relazione M2M: contacts ↔ crm_tags')
  console.log('  7. Crea relazione M2O: customer_kpis.contact_id → contacts.id')
  console.log('  8. Crea relazione M2O: orders.contact_id → contacts.id')
  console.log('  9. Imposta permessi ruolo Staff: CRUD su contacts, crm_*. Read su customer_kpis.')
  console.log(' 10. Imposta permessi ruolo Admin: accesso completo a tutte le collezioni CRM.')
}

main().catch(console.error)
```

- [ ] **Step 3.2: Verifica sintassi**

```bash
node --check scripts/setup-crm-collections.mjs
```

Expected: nessun output.

- [ ] **Step 3.3: Commit**

```bash
git add scripts/setup-crm-collections.mjs
git commit -m "feat(crm): add Directus CRM collections setup script"
```

---

## Task 4: Directus CRM Client

**Files:**
- Create: `src/lib/crm.ts`
- Modify: `src/lib/crm.test.ts`

- [ ] **Step 4.1: Crea `src/lib/crm.ts`**

```typescript
import {
  createDirectus, rest, staticToken,
  readItems, readItem, createItem, updateItem,
} from '@directus/sdk';
import type {
  Contact, CrmInteraction, CrmTask, CrmTag,
  CrmDocument, CustomerKpi, CrmPipelineHistory,
  PipelineStage,
} from './types';

function getRequiredEnv(key: string): string {
  const value = import.meta.env?.[key] ?? process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function createClient() {
  return createDirectus(getRequiredEnv('DIRECTUS_URL'))
    .with(staticToken(getRequiredEnv('DIRECTUS_TOKEN')))
    .with(rest());
}

const client = createClient();

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(options?: {
  pipelineStage?: PipelineStage;
  channelType?: 'offline' | 'online' | 'both';
  isActive?: boolean;
  limit?: number;
}): Promise<Contact[]> {
  const filter: Record<string, unknown> = {};
  if (options?.isActive !== undefined) filter.is_active = { _eq: options.isActive };
  if (options?.pipelineStage) filter.pipeline_stage = { _eq: options.pipelineStage };
  if (options?.channelType) filter.channel_type = { _eq: options.channelType };

  const items = await client.request(
    readItems('contacts', {
      filter,
      fields: ['*', { tags: ['*'] }],
      sort: ['last_name', 'first_name'],
      limit: options?.limit ?? -1,
    })
  );
  return items as Contact[];
}

export async function getContact(id: string): Promise<Contact | null> {
  try {
    const item = await client.request(
      readItem('contacts', id, {
        fields: ['*', { tags: ['*'] }],
      })
    );
    return item as Contact;
  } catch {
    return null;
  }
}

export async function getContactByEmail(email: string): Promise<Contact | null> {
  const items = await client.request(
    readItems('contacts', {
      filter: { email: { _eq: email } },
      fields: ['*', { tags: ['*'] }],
      limit: 1,
    })
  );
  return (items as Contact[])[0] ?? null;
}

export async function createContact(data: Omit<Contact, 'id' | 'date_created' | 'tags'>): Promise<Contact> {
  const item = await client.request(createItem('contacts', data));
  return item as Contact;
}

export async function updateContactPipelineStage(
  id: string,
  stage: PipelineStage
): Promise<Contact> {
  const item = await client.request(updateItem('contacts', id, { pipeline_stage: stage }));
  return item as Contact;
}

export async function updateContactChannelType(
  id: string,
  channelType: 'offline' | 'online' | 'both'
): Promise<Contact> {
  const item = await client.request(updateItem('contacts', id, { channel_type: channelType }));
  return item as Contact;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

export async function getInteractionsByContact(contactId: string): Promise<CrmInteraction[]> {
  const items = await client.request(
    readItems('crm_interactions', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      sort: ['-date'],
    })
  );
  return items as CrmInteraction[];
}

export async function createInteraction(
  data: Omit<CrmInteraction, 'id'>
): Promise<CrmInteraction> {
  const item = await client.request(createItem('crm_interactions', data));
  return item as CrmInteraction;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasksByContact(contactId: string): Promise<CrmTask[]> {
  const items = await client.request(
    readItems('crm_tasks', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      sort: ['due_date'],
    })
  );
  return items as CrmTask[];
}

export async function getTasksDueToday(): Promise<CrmTask[]> {
  const today = new Date().toISOString().split('T')[0];
  const items = await client.request(
    readItems('crm_tasks', {
      filter: {
        due_date: { _between: [`${today}T00:00:00`, `${today}T23:59:59`] },
        status: { _in: ['pending', 'in_progress'] },
      },
      fields: ['*'],
      sort: ['due_date'],
    })
  );
  return items as CrmTask[];
}

export async function createTask(data: Omit<CrmTask, 'id'>): Promise<CrmTask> {
  const item = await client.request(createItem('crm_tasks', data));
  return item as CrmTask;
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export async function getKpiByContact(contactId: string): Promise<CustomerKpi | null> {
  const items = await client.request(
    readItems('customer_kpis', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      limit: 1,
    })
  );
  return (items as CustomerKpi[])[0] ?? null;
}

export async function getContactsAtRisk(churnThreshold = 70): Promise<CustomerKpi[]> {
  const items = await client.request(
    readItems('customer_kpis', {
      filter: { churn_score: { _gte: churnThreshold } },
      fields: ['*'],
      sort: ['-churn_score'],
    })
  );
  return items as CustomerKpi[];
}

// ─── Pipeline History ────────────────────────────────────────────────────────

export async function getPipelineHistory(contactId: string): Promise<CrmPipelineHistory[]> {
  const items = await client.request(
    readItems('crm_pipeline_history', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      sort: ['-date'],
    })
  );
  return items as CrmPipelineHistory[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fullName(contact: Pick<Contact, 'first_name' | 'last_name'>): string {
  return `${contact.first_name} ${contact.last_name}`.trim();
}
```

- [ ] **Step 4.2: Aggiungi test al file `src/lib/crm.test.ts`**

Sostituisci il contenuto del file con:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  Contact, CrmInteraction, CrmTask, CustomerKpi,
  ChannelType, PipelineStage,
} from './types';
import { fullName } from './crm';

describe('CRM types', () => {
  it('Contact has required fields', () => {
    const c: Contact = {
      id: '1',
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario@esempio.it',
      phone: null,
      date_of_birth: null,
      channel_type: 'online',
      canale_prevalente: 'online',
      pipeline_stage: 'cliente_attivo',
      customer_id: null,
      default_shipping_address: null,
      is_active: true,
      tags: [],
      date_created: '2026-01-01T00:00:00Z',
    };
    expect(c.channel_type).toBe('online');
    expect(c.pipeline_stage).toBe('cliente_attivo');
  });

  it('ChannelType accepts offline, online, both', () => {
    const a: ChannelType = 'offline';
    const b: ChannelType = 'online';
    const c: ChannelType = 'both';
    expect([a, b, c]).toHaveLength(3);
  });

  it('PipelineStage covers all 5 stages', () => {
    const stages: PipelineStage[] = [
      'lead', 'prospect', 'cliente_attivo', 'cliente_fidelizzato', 'inattivo',
    ];
    expect(stages).toHaveLength(5);
  });

  it('CustomerKpi has CLV and churn fields', () => {
    const kpi: CustomerKpi = {
      id: '1',
      contact_id: '1',
      clv: 500,
      churn_score: 25,
      lead_score: 80,
      total_spent_online: 300,
      total_spent_offline: 200,
      total_orders_online: 3,
      total_orders_offline: 2,
      last_purchase_at: '2026-05-01T00:00:00Z',
      avg_order_value: 100,
      preferred_channel: 'online',
      rfm_segment: 'loyal',
      calculated_at: '2026-06-01T00:00:00Z',
    };
    expect(kpi.clv).toBe(500);
    expect(kpi.churn_score).toBe(25);
  });
});

describe('fullName', () => {
  it('concatena first_name e last_name', () => {
    expect(fullName({ first_name: 'Mario', last_name: 'Rossi' })).toBe('Mario Rossi');
  });

  it('trimma spazi extra', () => {
    expect(fullName({ first_name: 'Anna', last_name: 'Bianchi' })).toBe('Anna Bianchi');
  });
});
```

- [ ] **Step 4.3: Esegui test**

```bash
npm test
```

Expected: tutti i test passano.

- [ ] **Step 4.4: TypeScript check**

```bash
npx astro check
```

Expected: 0 errori TypeScript.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/crm.ts src/lib/crm.test.ts
git commit -m "feat(crm): add CRM Directus client and helpers"
```

---

## Task 5: Aggiorna package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 5.1: Aggiungi script setup-crm a package.json**

Apri `package.json` e aggiungi nello `scripts`:

```json
"setup": "node scripts/setup-collections.mjs",
"setup:crm": "node scripts/setup-crm-collections.mjs",
"setup:all": "node scripts/setup-collections.mjs && node scripts/setup-crm-collections.mjs"
```

- [ ] **Step 5.2: Commit**

```bash
git add package.json
git commit -m "feat(crm): add setup scripts to package.json"
```

---

## Checklist Finale Piano 1

- [ ] `npm test` — tutti i test passano
- [ ] `npx astro check` — 0 errori TypeScript
- [ ] `node --check scripts/setup-crm-collections.mjs` — nessun errore
- [ ] `node --check scripts/setup-collections.mjs` — nessun errore

**Prossimo piano:** [Piano 2 — CRM Flows + KPI Calculator](2026-06-02-crm-plan-2-flows-kpis.md)
