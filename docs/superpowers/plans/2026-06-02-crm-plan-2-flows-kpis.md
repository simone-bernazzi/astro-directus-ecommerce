# CRM Flows + KPI Calculator — Piano 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare il calcolatore KPI (CLV, churn score, lead score, RFM) come script Node.js eseguibile manualmente e come Directus Flow schedulato, più guida alla configurazione degli altri Flows in Directus.

**Architecture:** `scripts/calculate-kpis.mjs` è uno script standalone che legge tutti i contatti e i loro ordini da Directus, calcola i KPI con formule configurabili, e salva/aggiorna la collezione `customer_kpis`. Viene richiamato dal Flow `flow-kpi-nightly` come operazione "Run Script" in Directus. Gli altri Flows (`flow-contact-from-online-order`, `flow-pipeline-history`, `flow-stock-offline-order`) sono configurati manualmente in Directus Admin — la guida è in questo documento.

**Tech Stack:** Node.js 22, Directus SDK v21, Vitest.

**Prerequisito:** Piano 1 completato — collezioni CRM esistenti.

---

## Struttura File

```
scripts/
└── calculate-kpis.mjs             # NUOVO — calcolatore KPI standalone

src/lib/
├── kpi.ts                         # NUOVO — formule KPI pure (testabili senza Directus)
└── kpi.test.ts                    # NUOVO — test Vitest per le formule
```

---

## Task 1: Formule KPI Pure

**Files:**
- Create: `src/lib/kpi.ts`
- Create: `src/lib/kpi.test.ts`

Le formule sono funzioni pure — zero side effects, facili da testare e da sostituire per ogni cliente.

- [ ] **Step 1.1: Scrivi i test prima dell'implementazione (`src/lib/kpi.test.ts`)**

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateClv,
  calculateChurnScore,
  calculateLeadScore,
  calculateRfmSegment,
  calculatePreferredChannel,
  calculateAvgOrderValue,
} from './kpi';

describe('calculateClv', () => {
  it('restituisce 0 se non ci sono ordini', () => {
    expect(calculateClv({ totalSpent: 0, totalOrders: 0, daysSinceFirstOrder: 0 })).toBe(0);
  });

  it('calcola CLV annualizzato correttamente', () => {
    // avg = 100, freq = 12 ordini in 365gg = ~1/mese, clv annuale = 100 * 12 = 1200
    const clv = calculateClv({ totalSpent: 1200, totalOrders: 12, daysSinceFirstOrder: 365 });
    expect(clv).toBeCloseTo(1200, 0);
  });

  it('gestisce cliente con un solo ordine recente', () => {
    const clv = calculateClv({ totalSpent: 200, totalOrders: 1, daysSinceFirstOrder: 10 });
    expect(clv).toBeGreaterThan(0);
  });
});

describe('calculateChurnScore', () => {
  it('restituisce 90 per cliente senza acquisti da 181+ giorni', () => {
    expect(calculateChurnScore({ daysSinceLastPurchase: 200, totalOrders: 1 })).toBe(90);
  });

  it('restituisce 10 per cliente con acquisto negli ultimi 30 giorni', () => {
    expect(calculateChurnScore({ daysSinceLastPurchase: 10, totalOrders: 3 })).toBe(10);
  });

  it('riduce il punteggio per clienti con molti ordini', () => {
    const score5 = calculateChurnScore({ daysSinceLastPurchase: 100, totalOrders: 5 });
    const score1 = calculateChurnScore({ daysSinceLastPurchase: 100, totalOrders: 1 });
    expect(score5).toBeLessThan(score1);
  });

  it('non supera 100', () => {
    const score = calculateChurnScore({ daysSinceLastPurchase: 999, totalOrders: 0 });
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateRfmSegment', () => {
  it('champions: acquisto recente, alta frequenza, alto valore', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 10, totalOrders: 8, totalSpent: 2000 })).toBe('champions');
  });

  it('dormant: nessun acquisto da 180+ giorni', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 200, totalOrders: 2, totalSpent: 200 })).toBe('dormant');
  });

  it('new: primo acquisto recente', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 5, totalOrders: 1, totalSpent: 100 })).toBe('new');
  });

  it('at_risk: buona storia ma inattivo 90+ giorni', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 100, totalOrders: 4, totalSpent: 800 })).toBe('at_risk');
  });
});

describe('calculatePreferredChannel', () => {
  it('restituisce offline se ordini offline > online', () => {
    expect(calculatePreferredChannel({ onlineOrders: 2, offlineOrders: 5 })).toBe('offline');
  });

  it('restituisce online se ordini online > offline', () => {
    expect(calculatePreferredChannel({ onlineOrders: 7, offlineOrders: 1 })).toBe('online');
  });

  it('restituisce offline in caso di parità', () => {
    expect(calculatePreferredChannel({ onlineOrders: 3, offlineOrders: 3 })).toBe('offline');
  });
});

describe('calculateAvgOrderValue', () => {
  it('restituisce 0 se non ci sono ordini', () => {
    expect(calculateAvgOrderValue({ totalSpent: 0, totalOrders: 0 })).toBe(0);
  });

  it('calcola la media correttamente', () => {
    expect(calculateAvgOrderValue({ totalSpent: 300, totalOrders: 3 })).toBe(100);
  });
});
```

- [ ] **Step 1.2: Esegui test — verifica che falliscano**

```bash
npm test src/lib/kpi.test.ts
```

Expected: FAIL — `Cannot find module './kpi'`

- [ ] **Step 1.3: Implementa `src/lib/kpi.ts`**

```typescript
export interface ClvInput {
  totalSpent: number;
  totalOrders: number;
  daysSinceFirstOrder: number;
}

export interface ChurnInput {
  daysSinceLastPurchase: number;
  totalOrders: number;
}

export interface RfmInput {
  daysSinceLastPurchase: number;
  totalOrders: number;
  totalSpent: number;
}

export type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'dormant' | 'new' | 'other';

export function calculateClv({ totalSpent, totalOrders, daysSinceFirstOrder }: ClvInput): number {
  if (totalOrders === 0 || totalSpent === 0) return 0;
  const avgOrderValue = totalSpent / totalOrders;
  const daysActive = Math.max(daysSinceFirstOrder, 1);
  const ordersPerYear = (totalOrders / daysActive) * 365;
  return Math.round(avgOrderValue * ordersPerYear * 100) / 100;
}

export function calculateChurnScore({ daysSinceLastPurchase, totalOrders }: ChurnInput): number {
  let score: number;
  if (daysSinceLastPurchase > 180) score = 90;
  else if (daysSinceLastPurchase > 90) score = 60;
  else if (daysSinceLastPurchase > 60) score = 40;
  else if (daysSinceLastPurchase > 30) score = 20;
  else score = 10;

  if (totalOrders >= 6) score = Math.round(score * 0.6);
  else if (totalOrders >= 3) score = Math.round(score * 0.8);

  return Math.min(100, score);
}

export function calculateLeadScore({
  pipelineStage,
  daysSinceLastInteraction,
  totalInteractions,
}: {
  pipelineStage: string;
  daysSinceLastInteraction: number;
  totalInteractions: number;
}): number {
  const stageScore: Record<string, number> = {
    lead: 20,
    prospect: 50,
    cliente_attivo: 80,
    cliente_fidelizzato: 90,
    inattivo: 10,
  };
  let score = stageScore[pipelineStage] ?? 20;
  if (daysSinceLastInteraction <= 7) score = Math.min(100, score + 20);
  if (totalInteractions >= 3) score = Math.min(100, score + 10);
  return score;
}

export function calculateRfmSegment({ daysSinceLastPurchase, totalOrders, totalSpent }: RfmInput): RfmSegment {
  if (daysSinceLastPurchase > 180) return 'dormant';
  if (totalOrders === 1 && daysSinceLastPurchase <= 30) return 'new';
  if (daysSinceLastPurchase <= 30 && totalOrders >= 5 && totalSpent >= 500) return 'champions';
  if (totalOrders >= 5) return 'loyal';
  if (daysSinceLastPurchase > 90 && totalOrders >= 2) return 'at_risk';
  return 'other';
}

export function calculatePreferredChannel({
  onlineOrders,
  offlineOrders,
}: {
  onlineOrders: number;
  offlineOrders: number;
}): 'online' | 'offline' {
  return onlineOrders > offlineOrders ? 'online' : 'offline';
}

export function calculateAvgOrderValue({
  totalSpent,
  totalOrders,
}: {
  totalSpent: number;
  totalOrders: number;
}): number {
  if (totalOrders === 0) return 0;
  return Math.round((totalSpent / totalOrders) * 100) / 100;
}
```

- [ ] **Step 1.4: Esegui test — verifica che passino**

```bash
npm test src/lib/kpi.test.ts
```

Expected: PASS — tutti i test green.

- [ ] **Step 1.5: Esegui tutti i test**

```bash
npm test
```

Expected: tutti i test passano.

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/kpi.ts src/lib/kpi.test.ts
git commit -m "feat(crm): add KPI calculation formulas with tests"
```

---

## Task 2: Script KPI Calculator

**Files:**
- Create: `scripts/calculate-kpis.mjs`

- [ ] **Step 2.1: Crea `scripts/calculate-kpis.mjs`**

```javascript
// scripts/calculate-kpis.mjs
// Calcola KPI per tutti i contatti e aggiorna customer_kpis
// Usage: DIRECTUS_TOKEN=xxx node scripts/calculate-kpis.mjs
// Opzioni: --contact-id=xxx (ricalcola solo un contatto)

import { createDirectus, rest, staticToken, readItems, createItem, updateItem } from '@directus/sdk'
import {
  calculateClv,
  calculateChurnScore,
  calculateLeadScore,
  calculateRfmSegment,
  calculatePreferredChannel,
  calculateAvgOrderValue,
} from '../src/lib/kpi.js'

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? 'http://localhost:8055'
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN

if (!DIRECTUS_TOKEN) {
  console.error('Errore: DIRECTUS_TOKEN non impostato')
  process.exit(1)
}

const client = createDirectus(DIRECTUS_URL)
  .with(staticToken(DIRECTUS_TOKEN))
  .with(rest())

const targetContactId = process.argv.find(a => a.startsWith('--contact-id='))?.split('=')[1]

function daysBetween(dateStr) {
  if (!dateStr) return 9999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

async function fetchOrdersForContact(contactId) {
  return client.request(readItems('orders', {
    filter: { contact_id: { _eq: contactId }, status: { _in: ['paid', 'shipped', 'delivered'] } },
    fields: ['id', 'total', 'channel', 'date_created'],
    limit: -1,
  }))
}

async function fetchInteractionsForContact(contactId) {
  return client.request(readItems('crm_interactions', {
    filter: { contact_id: { _eq: contactId } },
    fields: ['id', 'date'],
    sort: ['-date'],
    limit: -1,
  }))
}

async function upsertKpi(contactId, kpiData) {
  const existing = await client.request(readItems('customer_kpis', {
    filter: { contact_id: { _eq: contactId } },
    fields: ['id'],
    limit: 1,
  }))

  if (existing.length > 0) {
    await client.request(updateItem('customer_kpis', existing[0].id, kpiData))
  } else {
    await client.request(createItem('customer_kpis', { contact_id: contactId, ...kpiData }))
  }
}

async function processContact(contact) {
  const orders = await fetchOrdersForContact(contact.id)
  const interactions = await fetchInteractionsForContact(contact.id)

  const onlineOrders = orders.filter(o => o.channel === 'online')
  const offlineOrders = orders.filter(o => o.channel === 'offline')

  const totalSpentOnline = onlineOrders.reduce((s, o) => s + Number(o.total), 0)
  const totalSpentOffline = offlineOrders.reduce((s, o) => s + Number(o.total), 0)
  const totalSpent = totalSpentOnline + totalSpentOffline
  const totalOrders = orders.length

  const sortedOrders = [...orders].sort((a, b) => new Date(a.date_created) - new Date(b.date_created))
  const firstOrderDate = sortedOrders[0]?.date_created ?? null
  const lastOrderDate = sortedOrders[sortedOrders.length - 1]?.date_created ?? null

  const daysSinceFirstOrder = daysBetween(firstOrderDate)
  const daysSinceLastPurchase = daysBetween(lastOrderDate)
  const lastInteractionDate = interactions[0]?.date ?? null
  const daysSinceLastInteraction = daysBetween(lastInteractionDate)

  const clv = calculateClv({ totalSpent, totalOrders, daysSinceFirstOrder })
  const churnScore = calculateChurnScore({ daysSinceLastPurchase, totalOrders })
  const leadScore = calculateLeadScore({
    pipelineStage: contact.pipeline_stage,
    daysSinceLastInteraction,
    totalInteractions: interactions.length,
  })
  const rfmSegment = calculateRfmSegment({ daysSinceLastPurchase, totalOrders, totalSpent })
  const preferredChannel = calculatePreferredChannel({
    onlineOrders: onlineOrders.length,
    offlineOrders: offlineOrders.length,
  })
  const avgOrderValue = calculateAvgOrderValue({ totalSpent, totalOrders })

  await upsertKpi(contact.id, {
    clv,
    churn_score: churnScore,
    lead_score: leadScore,
    total_spent_online: totalSpentOnline,
    total_spent_offline: totalSpentOffline,
    total_orders_online: onlineOrders.length,
    total_orders_offline: offlineOrders.length,
    last_purchase_at: lastOrderDate,
    avg_order_value: avgOrderValue,
    preferred_channel: preferredChannel,
    rfm_segment: rfmSegment,
    calculated_at: new Date().toISOString(),
  })
}

async function main() {
  console.log(`\nKPI Calculator → ${DIRECTUS_URL}`)
  if (targetContactId) console.log(`Modalità: singolo contatto (id: ${targetContactId})`)
  console.log()

  const filter = targetContactId
    ? { id: { _eq: targetContactId }, is_active: { _eq: true } }
    : { is_active: { _eq: true } }

  const contacts = await client.request(readItems('contacts', {
    filter,
    fields: ['id', 'pipeline_stage'],
    limit: -1,
  }))

  console.log(`Contatti da processare: ${contacts.length}\n`)

  let success = 0
  let errors = 0

  for (const contact of contacts) {
    try {
      await processContact(contact)
      console.log(`  ✓ contact ${contact.id}`)
      success++
    } catch (e) {
      console.error(`  ✗ contact ${contact.id}: ${e.message}`)
      errors++
    }
  }

  console.log(`\n✓ Completato: ${success} successi, ${errors} errori.`)
  if (errors > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2.2: Installa tsx — runner TypeScript per Node.js**

`calculate-kpis.mjs` importa `src/lib/kpi.ts`. Per eseguire script Node che importano TypeScript senza compilazione manuale, usiamo `tsx`:

```bash
npm install --save-dev tsx
```

Expected: nessun errore.

- [ ] **Step 2.3: Verifica sintassi**

```bash
node --check scripts/calculate-kpis.mjs
```

Expected: nessun output.

- [ ] **Step 2.4: Aggiungi script a package.json**

Apri `package.json` e aggiungi in `scripts`:

```json
"kpis": "npx tsx scripts/calculate-kpis.mjs",
"kpis:contact": "npx tsx scripts/calculate-kpis.mjs --contact-id="
```

- [ ] **Step 2.5: Commit**

```bash
git add scripts/calculate-kpis.mjs package.json package-lock.json
git commit -m "feat(crm): add KPI calculator script with tsx runner"
```

---

## Task 3: Configurazione Flows in Directus

Questi Flows si configurano manualmente in **Directus Admin → Flows**. Non richiedono codice nel repo — questa sezione è la guida operativa.

- [ ] **Step 3.1: Flow — `flow-contact-from-online-order`**

**Trigger:** Event Hook — `items.create` su `orders` (filter: `channel = online`)

**Operazioni in sequenza:**

1. **Leggi dati ordine** (Read Data)
   - Collection: `orders`
   - Query: `{ filter: { id: { _eq: "{{$trigger.key}}" } }, fields: ["customer_email","customer_name","contact_id"] }`

2. **Condition: contact_id già presente?**
   - Condition: `{{read_order.contact_id}} != null`
   - Se true → END (contatto già collegato)

3. **Cerca contatto per email** (Read Data)
   - Collection: `contacts`
   - Query: `{ filter: { email: { _eq: "{{read_order.customer_email}}" } }, limit: 1 }`

4. **Condition: contatto esistente?**
   - Condition: `{{search_contact}} != []`
   - Se true → **Step 5 (aggiorna)**, Se false → **Step 6 (crea)**

5. **Aggiorna channel_type a "both"** (Update Data)
   - Collection: `contacts`
   - IDs: `["{{search_contact[0].id}}"]`
   - Payload: `{ "channel_type": "both" }`
   - Poi → Step 7

6. **Crea nuovo contatto** (Create Data)
   - Collection: `contacts`
   - Payload:
     ```json
     {
       "first_name": "{{read_order.customer_name.split(' ')[0]}}",
       "last_name": "{{read_order.customer_name.split(' ').slice(1).join(' ')}}",
       "email": "{{read_order.customer_email}}",
       "channel_type": "online",
       "canale_prevalente": "online",
       "pipeline_stage": "cliente_attivo",
       "is_active": true
     }
     ```

7. **Aggiorna ordine con contact_id** (Update Data)
   - Collection: `orders`
   - IDs: `["{{$trigger.key}}"]`
   - Payload: `{ "contact_id": "{{search_contact[0].id ?? create_contact.id}}" }`

- [ ] **Step 3.2: Flow — `flow-pipeline-history`**

**Trigger:** Event Hook — `items.update` su `contacts` (filter: campo `pipeline_stage` modificato)

**Operazioni:**

1. **Condition: pipeline_stage cambiato?**
   - Condition: `{{$trigger.payload.pipeline_stage}} != null`

2. **Leggi valore precedente** (Read Data)
   - Collection: `contacts`
   - Query: `{ filter: { id: { _eq: "{{$trigger.key}}" } }, fields: ["pipeline_stage"] }`
   - Nota: Directus fornisce `$trigger.payload` (nuovo) e puoi leggere il vecchio prima del salvataggio solo con hook `items.update` in modalità "Before Save". Configurare il trigger come `action: update, timing: before`.

3. **Crea record history** (Create Data)
   - Collection: `crm_pipeline_history`
   - Payload:
     ```json
     {
       "contact_id": "{{$trigger.key}}",
       "from_stage": "{{read_contact.pipeline_stage}}",
       "to_stage": "{{$trigger.payload.pipeline_stage}}",
       "date": "{{$now}}",
       "changed_by": "{{$accountability.user}}"
     }
     ```

- [ ] **Step 3.3: Flow — `flow-stock-offline-order`**

**Trigger:** Event Hook — `items.create` su `orders` (filter: `channel = offline`)

**Operazioni:**

1. **Leggi order_items** (Read Data)
   - Collection: `order_items`
   - Query: `{ filter: { order_id: { _eq: "{{$trigger.key}}" } }, fields: ["*"] }`

2. **For each order_item** (usa JS Operation):
   ```javascript
   // Directus Flow — JS Operation
   // Per ogni item, decrementa stock_quantity del variant
   const items = data['read_order_items'];
   return items.map(item => ({
     variant_id: item.variant_id,
     quantity: item.quantity,
   }));
   ```

3. **Aggiorna stock** (Update Data — ripeti per ogni item)
   - Collection: `product_variants`
   - Nota: Directus Flows non ha un loop nativo efficiente per aggiornamenti multipli. Alternativa consigliata: usare una JS Operation che chiama l'API Directus in loop interno, oppure eseguire `scripts/decrement-stock.mjs` via webhook esterno.

   **Alternativa pratica — JS Operation con fetch interno:**
   ```javascript
   const items = data['read_order_items'];
   const DIRECTUS_URL = process.env.DIRECTUS_URL;
   const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

   for (const item of items) {
     const variant = await fetch(`${DIRECTUS_URL}/items/product_variants/${item.variant_id}`, {
       headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }
     }).then(r => r.json());

     const newStock = Math.max(0, variant.data.stock_quantity - item.quantity);
     await fetch(`${DIRECTUS_URL}/items/product_variants/${item.variant_id}`, {
       method: 'PATCH',
       headers: {
         Authorization: `Bearer ${DIRECTUS_TOKEN}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ stock_quantity: newStock }),
     });
   }

   return { updated: items.length };
   ```

- [ ] **Step 3.4: Flow — `flow-kpi-nightly`**

**Trigger:** Schedule — `0 2 * * *` (ogni notte alle 02:00)

**Operazioni:**

1. **Run Script** (JS Operation o Webhook):
   - Opzione A — JS Operation che esegue la logica di calcolo inline (copia la logica di `calculate-kpis.mjs`)
   - Opzione B (raccomandato) — Webhook POST a un endpoint interno del VPS che esegue `npm run kpis`

   Per l'opzione B, crea `src/pages/api/internal/run-kpis.ts`:
   ```typescript
   import type { APIRoute } from 'astro';
   import { execFile } from 'child_process';
   import { promisify } from 'util';

   const execFileAsync = promisify(execFile);

   export const POST: APIRoute = async ({ request }) => {
     const secret = request.headers.get('x-internal-secret');
     if (secret !== import.meta.env.INTERNAL_SECRET) {
       return new Response('Unauthorized', { status: 401 });
     }
     try {
       const { stdout } = await execFileAsync('node', ['scripts/calculate-kpis.mjs']);
       return new Response(JSON.stringify({ ok: true, output: stdout }), {
         headers: { 'Content-Type': 'application/json' },
       });
     } catch (e) {
       return new Response(JSON.stringify({ ok: false, error: String(e) }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' },
       });
     }
   };
   ```

   Aggiungi a `.env`:
   ```bash
   INTERNAL_SECRET=genera-una-stringa-casuale-sicura
   ```

   Nel Flow Directus: Webhook → `POST https://tuodominio.it/api/internal/run-kpis` con header `x-internal-secret: {{INTERNAL_SECRET}}`.

- [ ] **Step 3.5: Commit documentazione flows**

```bash
git add src/pages/api/internal/run-kpis.ts
git commit -m "feat(crm): add internal KPI trigger endpoint for Directus Flow"
```

---

## Checklist Finale Piano 2

- [ ] `npm test` — tutti i test KPI passano
- [ ] `node --check scripts/calculate-kpis.mjs` — nessun errore
- [ ] Flow `flow-contact-from-online-order` configurato in Directus
- [ ] Flow `flow-pipeline-history` configurato in Directus
- [ ] Flow `flow-stock-offline-order` configurato in Directus
- [ ] Flow `flow-kpi-nightly` configurato in Directus (schedule 02:00)
- [ ] Test manuale: `DIRECTUS_TOKEN=xxx node scripts/calculate-kpis.mjs --contact-id=1`

**Prossimo piano:** [Piano 3 — Contact Forms](2026-06-02-crm-plan-3-contact-forms.md)
