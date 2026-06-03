# Contact Forms — Piano 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare il sistema Contact Forms completo — collezioni Directus, TypeScript types, client helper, componente Astro `FormRenderer`, API endpoint SSR con pipeline anti-spam (honeypot, reCAPTCHA, country filter, keyword filter), notifica email admin con UTM tracking.

**Architecture:** Admin configura i form in Directus (collezione `forms` con campi JSON). `FormRenderer.astro` fetcha la config e renderizza i campi dinamicamente. Il submit va a `POST /api/form/[slug]` (Astro SSR endpoint) che esegue 9 step in sequenza: honeypot → country → reCAPTCHA → Zod → keyword → salva → email → risposta. Geo-detection via `ip-api.com` (default), MaxMind GeoLite2 o Cloudflare header (configurabile via `GEO_PROVIDER` env var).

**Tech Stack:** Astro SSR, TypeScript, Zod v3, Nodemailer, Vitest, `@astrojs/node`, Node.js 22.

**Prerequisito:** Piano 1 completato.

---

## Struttura File

```
scripts/
└── setup-forms-collections.mjs        # NUOVO — crea collezioni forms/form_submissions

src/lib/
├── types.ts                           # MODIFICATO — aggiunge Form, FormField, FormSubmission
├── forms.ts                           # NUOVO — getForm(), getForms(), helpers
├── forms.test.ts                      # NUOVO — test Vitest
└── geo.ts                             # NUOVO — rilevamento paese (ip-api / maxmind / cloudflare)

src/components/forms/
└── FormRenderer.astro                 # NUOVO — componente generico form

src/pages/api/form/
└── [slug].ts                          # NUOVO — endpoint POST SSR
```

**Dipendenza da installare:**
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

---

## Task 1: Setup Collezioni Forms

**Files:**
- Create: `scripts/setup-forms-collections.mjs`

- [ ] **Step 1.1: Crea `scripts/setup-forms-collections.mjs`**

```javascript
// scripts/setup-forms-collections.mjs
// Crea le collezioni forms e form_submissions in Directus
// Usage: DIRECTUS_TOKEN=xxx node scripts/setup-forms-collections.mjs

import { createDirectus, rest, staticToken, createCollection, createField } from '@directus/sdk'

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
  console.log(`\nSetup collezioni Contact Forms → ${DIRECTUS_URL}\n`)

  // ── forms ─────────────────────────────────────────────────────────────────
  await collection('forms', 'dynamic_form', '{{name}}')
  await field('forms', 'name', 'string', { is_nullable: false }, { interface: 'input', required: true })
  await field('forms', 'slug', 'string', { is_unique: true }, { interface: 'input', required: true, note: 'Usato come URL: /api/form/[slug]' })
  await field('forms', 'fields', 'json', { is_nullable: false }, {
    interface: 'input-code',
    options: { language: 'json' },
    note: 'Array JSON: [{name, label, type, required, placeholder?, options?}]',
  })
  await field('forms', 'success_message', 'text', { is_nullable: true }, { interface: 'input-multiline', note: 'Mostrato dopo invio se redirect disabilitato' })
  await field('forms', 'redirect_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'redirect_url', 'string', { is_nullable: true }, { interface: 'input', note: 'Es. /grazie — attivo solo se redirect_enabled=true' })
  await field('forms', 'notification_email', 'string', { is_nullable: true }, { interface: 'input', note: 'Email dove arriva la notifica admin' })
  await field('forms', 'recaptcha_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'capture_ip', 'boolean', { default_value: false }, { interface: 'boolean', note: 'Dato sensibile — GDPR. Default off.' })
  await field('forms', 'capture_user_agent', 'boolean', { default_value: false }, { interface: 'boolean', note: 'Dato sensibile — GDPR. Default off.' })
  await field('forms', 'capture_page_url', 'boolean', { default_value: true }, { interface: 'boolean', note: 'Cattura URL + UTM params. Meno sensibile.' })
  await field('forms', 'honeypot_enabled', 'boolean', { default_value: true }, { interface: 'boolean', note: 'Anti-spam campo nascosto. Sempre raccomandato.' })
  await field('forms', 'country_filter_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'allowed_countries', 'json', { is_nullable: true }, {
    interface: 'input-code',
    options: { language: 'json' },
    note: 'Array ISO codes es. ["IT","CH","DE"]',
  })
  await field('forms', 'keyword_filter_enabled', 'boolean', { default_value: false }, { interface: 'boolean' })
  await field('forms', 'blocked_keywords', 'json', { is_nullable: true }, {
    interface: 'input-code',
    options: { language: 'json' },
    note: 'Array parole bloccate es. ["casino","spam"]',
  })
  await field('forms', 'is_active', 'boolean', { default_value: true }, { interface: 'boolean' })

  // ── form_submissions ───────────────────────────────────────────────────────
  await collection('form_submissions', 'inbox', '{{form_id}} — {{date_created}}')
  await field('form_submissions', 'form_id', 'integer', { is_nullable: false }, { interface: 'input', hidden: true })
  await field('form_submissions', 'data', 'json', { is_nullable: false }, {
    interface: 'input-code',
    options: { language: 'json' },
    note: 'Valori compilati dall\'utente',
  })
  await field('form_submissions', 'page_url', 'string', { is_nullable: true }, { interface: 'input', note: 'URL pagina + UTM params (se capture_page_url=true)' })
  await field('form_submissions', 'ip_address', 'string', { is_nullable: true }, { interface: 'input', note: 'Solo se capture_ip=true' })
  await field('form_submissions', 'user_agent', 'string', { is_nullable: true }, { interface: 'input', note: 'Solo se capture_user_agent=true' })
  await field('form_submissions', 'country_code', 'string', { is_nullable: true }, { interface: 'input', note: 'Codice ISO paese — da geo-provider' })
  await field('form_submissions', 'is_read', 'boolean', { default_value: false }, { interface: 'boolean' })

  console.log('\n✓ Setup Contact Forms completato.')
  console.log('\nPassaggi manuali in Directus Admin:')
  console.log('  1. Crea relazione M2O: form_submissions.form_id → forms.id')
  console.log('  2. Imposta permessi ruolo Public: Read su forms (solo campi non sensibili — NO blocked_keywords, NO notification_email)')
  console.log('  3. Imposta permessi ruolo Public: Create su form_submissions (solo campo data, page_url)')
  console.log('     Nota: la write su form_submissions avviene dal server con DIRECTUS_TOKEN, non dal client')
}

main().catch(console.error)
```

- [ ] **Step 1.2: Verifica sintassi**

```bash
node --check scripts/setup-forms-collections.mjs
```

Expected: nessun output.

- [ ] **Step 1.3: Aggiungi script a package.json**

In `scripts` di `package.json`:
```json
"setup:forms": "node scripts/setup-forms-collections.mjs",
"setup:all": "node scripts/setup-collections.mjs && node scripts/setup-crm-collections.mjs && node scripts/setup-forms-collections.mjs"
```

- [ ] **Step 1.4: Commit**

```bash
git add scripts/setup-forms-collections.mjs package.json
git commit -m "feat(forms): add Contact Forms Directus collections setup script"
```

---

## Task 2: TypeScript Types + Geo Helper

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/geo.ts`
- Create: `src/lib/forms.test.ts`

- [ ] **Step 2.1: Aggiungi tipi Forms a `src/lib/types.ts`**

In fondo al file, dopo i tipi CRM:

```typescript
// ─── Contact Forms ────────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'file';

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface Form {
  id: string;
  name: string;
  slug: string;
  fields: FormField[];
  success_message: string | null;
  redirect_enabled: boolean;
  redirect_url: string | null;
  notification_email: string | null;
  recaptcha_enabled: boolean;
  capture_ip: boolean;
  capture_user_agent: boolean;
  capture_page_url: boolean;
  honeypot_enabled: boolean;
  country_filter_enabled: boolean;
  allowed_countries: string[] | null;
  keyword_filter_enabled: boolean;
  blocked_keywords: string[] | null;
  is_active: boolean;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  data: Record<string, unknown>;
  page_url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country_code: string | null;
  is_read: boolean;
  date_created: string;
}
```

- [ ] **Step 2.2: Crea `src/lib/geo.ts`**

```typescript
export type GeoProvider = 'ip-api' | 'maxmind' | 'cloudflare';

const GEO_PROVIDER = (process.env.GEO_PROVIDER ?? 'ip-api') as GeoProvider;

async function getCountryFromIpApi(ip: string): Promise<string | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { countryCode?: string };
    return data.countryCode ?? null;
  } catch {
    return null;
  }
}

async function getCountryFromMaxMind(ip: string): Promise<string | null> {
  // Richiede: npm install @maxmind/geoip2-node + database GeoLite2-Country.mmdb
  // Documentato in docs/geo-filter-maxmind.md
  // Questa implementazione è un placeholder — sostituisci con il reader MaxMind
  console.warn('MaxMind GeoIP2 non configurato — tornando a ip-api.com');
  return getCountryFromIpApi(ip);
}

export async function detectCountry(
  request: Request,
  clientIp: string
): Promise<string | null> {
  if (GEO_PROVIDER === 'cloudflare') {
    return request.headers.get('cf-ipcountry');
  }
  if (GEO_PROVIDER === 'maxmind') {
    return getCountryFromMaxMind(clientIp);
  }
  return getCountryFromIpApi(clientIp);
}

export function extractClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}
```

- [ ] **Step 2.3: Crea `src/lib/forms.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import type { Form, FormField } from './types';

describe('Form types', () => {
  it('FormField ha i campi obbligatori', () => {
    const field: FormField = {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    };
    expect(field.type).toBe('email');
    expect(field.required).toBe(true);
  });

  it('FormField select ha options', () => {
    const field: FormField = {
      name: 'servizio',
      label: 'Servizio',
      type: 'select',
      required: false,
      options: ['Info', 'Preventivo'],
    };
    expect(field.options).toHaveLength(2);
  });

  it('Form ha tutte le feature flags', () => {
    const form: Form = {
      id: '1',
      name: 'Contattaci',
      slug: 'contattaci',
      fields: [],
      success_message: 'Grazie!',
      redirect_enabled: false,
      redirect_url: null,
      notification_email: 'admin@test.it',
      recaptcha_enabled: false,
      capture_ip: false,
      capture_user_agent: false,
      capture_page_url: true,
      honeypot_enabled: true,
      country_filter_enabled: false,
      allowed_countries: null,
      keyword_filter_enabled: false,
      blocked_keywords: null,
      is_active: true,
    };
    expect(form.honeypot_enabled).toBe(true);
    expect(form.capture_ip).toBe(false);
  });
});

describe('keyword filter logic', () => {
  function containsBlockedKeyword(data: Record<string, unknown>, keywords: string[]): boolean {
    const values = Object.values(data).join(' ').toLowerCase();
    return keywords.some(kw => values.includes(kw.toLowerCase()));
  }

  it('rileva parola bloccata', () => {
    expect(containsBlockedKeyword({ msg: 'buy casino chips' }, ['casino'])).toBe(true);
  });

  it('non blocca testo normale', () => {
    expect(containsBlockedKeyword({ msg: 'vorrei un preventivo' }, ['casino', 'viagra'])).toBe(false);
  });

  it('case insensitive', () => {
    expect(containsBlockedKeyword({ msg: 'CASINO FREE' }, ['casino'])).toBe(true);
  });
});
```

- [ ] **Step 2.4: Esegui test**

```bash
npm test
```

Expected: tutti i test passano.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/types.ts src/lib/geo.ts src/lib/forms.test.ts
git commit -m "feat(forms): add Form types and geo-detection helper"
```

---

## Task 3: Forms Client Helper

**Files:**
- Create: `src/lib/forms.ts`

- [ ] **Step 3.1: Installa Nodemailer**

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

Expected: nessun errore.

- [ ] **Step 3.2: Crea `src/lib/forms.ts`**

```typescript
import {
  createDirectus, rest, staticToken,
  readItems, readItem, createItem,
} from '@directus/sdk';
import nodemailer from 'nodemailer';
import type { Form, FormField, FormSubmission } from './types';

function getEnv(key: string): string | undefined {
  return import.meta.env?.[key] ?? process.env[key];
}

function createClient() {
  const url = getEnv('DIRECTUS_URL');
  const token = getEnv('DIRECTUS_TOKEN');
  if (!url || !token) throw new Error('Missing DIRECTUS_URL or DIRECTUS_TOKEN');
  return createDirectus(url).with(staticToken(token)).with(rest());
}

// ─── Directus queries ────────────────────────────────────────────────────────

export async function getForm(slug: string): Promise<Form | null> {
  const client = createClient();
  const items = await client.request(
    readItems('forms', {
      filter: { slug: { _eq: slug }, is_active: { _eq: true } },
      fields: ['*'],
      limit: 1,
    })
  );
  return (items as Form[])[0] ?? null;
}

export async function getForms(): Promise<Form[]> {
  const client = createClient();
  const items = await client.request(
    readItems('forms', {
      filter: { is_active: { _eq: true } },
      fields: ['id', 'name', 'slug'],
    })
  );
  return items as Form[];
}

export async function saveSubmission(
  formId: string,
  payload: Omit<FormSubmission, 'id' | 'date_created' | 'is_read'>
): Promise<FormSubmission> {
  const client = createClient();
  const item = await client.request(createItem('form_submissions', { form_id: formId, ...payload }));
  return item as FormSubmission;
}

// ─── Zod schema builder ──────────────────────────────────────────────────────

export function buildZodSchema(fields: FormField[]) {
  const { z } = await import('zod').catch(() => { throw new Error('zod non trovato'); });
  // Costruito dinamicamente — ogni campo required diventa z.string().min(1), opzionale z.string().optional()
  const shape: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === 'checkbox') {
      shape[f.name] = f.required ? z.literal('on') : z.string().optional();
    } else {
      shape[f.name] = f.required
        ? z.string({ required_error: `${f.label} è obbligatorio` }).min(1, `${f.label} è obbligatorio`)
        : z.string().optional();
    }
  }
  return z.object(shape);
}

// ─── Keyword filter ───────────────────────────────────────────────────────────

export function containsBlockedKeyword(
  data: Record<string, unknown>,
  keywords: string[]
): boolean {
  const allValues = Object.values(data).join(' ').toLowerCase();
  return keywords.some(kw => allValues.includes(kw.toLowerCase()));
}

// ─── Email notification ───────────────────────────────────────────────────────

export async function sendNotificationEmail(options: {
  to: string;
  formName: string;
  data: Record<string, unknown>;
  pageUrl: string | null;
  country: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  submittedAt: string;
}): Promise<void> {
  const host = getEnv('SMTP_HOST');
  const port = parseInt(getEnv('SMTP_PORT') ?? '587', 10);
  const user = getEnv('SMTP_USER');
  const pass = getEnv('SMTP_PASS');

  if (!host || !user || !pass) {
    console.warn('SMTP non configurato — email notifica non inviata');
    return;
  }

  const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });

  const fieldsHtml = Object.entries(options.data)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:bold;">${k}</td><td style="padding:4px 8px;">${v}</td></tr>`)
    .join('');

  const metaRows = [
    options.pageUrl ? `<tr><td style="padding:4px 8px;font-weight:bold;">URL pagina</td><td style="padding:4px 8px;">${options.pageUrl}</td></tr>` : '',
    options.country ? `<tr><td style="padding:4px 8px;font-weight:bold;">Paese</td><td style="padding:4px 8px;">${options.country}</td></tr>` : '',
    options.ipAddress ? `<tr><td style="padding:4px 8px;font-weight:bold;">IP</td><td style="padding:4px 8px;">${options.ipAddress}</td></tr>` : '',
    options.userAgent ? `<tr><td style="padding:4px 8px;font-weight:bold;">User Agent</td><td style="padding:4px 8px;font-size:11px;">${options.userAgent}</td></tr>` : '',
    `<tr><td style="padding:4px 8px;font-weight:bold;">Data/ora</td><td style="padding:4px 8px;">${options.submittedAt}</td></tr>`,
  ].filter(Boolean).join('');

  const html = `
    <h2>Nuovo invio form: ${options.formName}</h2>
    <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
      ${fieldsHtml}
    </table>
    <hr style="margin:16px 0;">
    <h3 style="color:#6b7280;">Info invio</h3>
    <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px;color:#6b7280;">
      ${metaRows}
    </table>
  `;

  await transporter.sendMail({
    from: user,
    to: options.to,
    subject: `[Form] Nuovo messaggio da: ${options.formName}`,
    html,
  });
}
```

- [ ] **Step 3.3: Esegui TypeScript check**

```bash
npx astro check
```

Expected: 0 errori.

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/forms.ts package.json package-lock.json
git commit -m "feat(forms): add Forms client helper and email notification"
```

---

## Task 4: Componente FormRenderer

**Files:**
- Create: `src/components/forms/FormRenderer.astro`

- [ ] **Step 4.1: Crea `src/components/forms/FormRenderer.astro`**

```astro
---
import { getForm } from '../../lib/forms';
import type { FormField } from '../../lib/types';

interface Props {
  slug: string;
  class?: string;
}

const { slug, class: className = '' } = Astro.props;
const form = await getForm(slug);

const recaptchaSiteKey = import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY ?? '';
---

{!form && (
  <p class="text-[var(--color-muted)] text-sm">Form non trovato.</p>
)}

{form && (
  <div class={className}>
    <form
      id={`form-${form.slug}`}
      data-slug={form.slug}
      data-redirect-enabled={form.redirect_enabled}
      data-redirect-url={form.redirect_url ?? ''}
      data-success-message={form.success_message ?? 'Messaggio inviato con successo.'}
      data-recaptcha={form.recaptcha_enabled}
      class="space-y-5"
      novalidate
    >
      <!-- Honeypot (nascosto via CSS — i bot lo compilano, gli umani no) -->
      {form.honeypot_enabled && (
        <div style="position:absolute;left:-9999px;top:-9999px;" aria-hidden="true">
          <input type="text" name="_hp_field" tabindex="-1" autocomplete="off" />
        </div>
      )}

      <!-- Page URL (hidden, popolato da JS) -->
      {form.capture_page_url && (
        <input type="hidden" name="_page_url" id="field-page-url" />
      )}

      <!-- Campi dinamici -->
      {form.fields.map((field: FormField) => (
        <div class="flex flex-col gap-1">
          <label for={`field-${field.name}`} class="text-sm font-medium text-[var(--color-text)]">
            {field.label}
            {field.required && <span class="text-[var(--color-error)] ml-1" aria-hidden="true">*</span>}
          </label>

          {field.type === 'textarea' && (
            <textarea
              id={`field-${field.name}`}
              name={field.name}
              required={field.required}
              placeholder={field.placeholder ?? ''}
              rows={4}
              class="w-full border border-gray-200 rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
          )}

          {field.type === 'select' && (
            <select
              id={`field-${field.name}`}
              name={field.name}
              required={field.required}
              class="w-full border border-gray-200 rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            >
              <option value="">Seleziona...</option>
              {(field.options ?? []).map((opt: string) => (
                <option value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === 'checkbox' && (
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id={`field-${field.name}`}
                name={field.name}
                required={field.required}
                class="w-4 h-4 accent-[var(--color-brand)]"
              />
              <span class="text-sm text-[var(--color-muted)]">{field.placeholder}</span>
            </div>
          )}

          {!['textarea', 'select', 'checkbox'].includes(field.type) && (
            <input
              type={field.type}
              id={`field-${field.name}`}
              name={field.name}
              required={field.required}
              placeholder={field.placeholder ?? ''}
              class="w-full border border-gray-200 rounded-[var(--radius)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
          )}
        </div>
      ))}

      <!-- reCAPTCHA badge -->
      {form.recaptcha_enabled && recaptchaSiteKey && (
        <p class="text-xs text-[var(--color-muted)]">
          🔒 Questo form è protetto da reCAPTCHA v3
        </p>
      )}

      <!-- Submit -->
      <button
        type="submit"
        class="w-full px-6 py-3 bg-[var(--color-brand)] text-white rounded-[var(--radius)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        Invia messaggio
      </button>

      <!-- Feedback -->
      <div id={`feedback-${form.slug}`} class="hidden" role="alert" aria-live="polite"></div>
    </form>
  </div>
)}

{form?.recaptcha_enabled && recaptchaSiteKey && (
  <script
    src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`}
    defer
  />
)}

<script>
  document.querySelectorAll('form[data-slug]').forEach((formEl) => {
    const slug = formEl.dataset.slug;
    const feedbackEl = document.getElementById(`feedback-${slug}`);
    const pageUrlField = formEl.querySelector('#field-page-url') as HTMLInputElement | null;

    // Popola page_url con l'URL corrente (include UTM params)
    if (pageUrlField) {
      pageUrlField.value = window.location.href;
    }

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn.disabled = true;

      const formData = new FormData(form);

      // reCAPTCHA v3
      const useRecaptcha = form.dataset.recaptcha === 'true';
      if (useRecaptcha && typeof grecaptcha !== 'undefined') {
        const siteKey = document.querySelector('script[src*="recaptcha"]')?.getAttribute('src')?.match(/render=([^&]+)/)?.[1] ?? '';
        const token = await grecaptcha.execute(siteKey, { action: 'submit_form' });
        formData.append('_recaptcha_token', token);
      }

      try {
        const res = await fetch(`/api/form/${slug}`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (data.redirect && form.dataset.redirectEnabled === 'true' && form.dataset.redirectUrl) {
          window.location.href = form.dataset.redirectUrl;
          return;
        }

        if (feedbackEl) {
          feedbackEl.textContent = data.message ?? form.dataset.successMessage ?? 'Inviato!';
          feedbackEl.className = res.ok
            ? 'p-3 rounded bg-green-50 text-green-700 text-sm mt-2'
            : 'p-3 rounded bg-red-50 text-red-700 text-sm mt-2';
        }

        if (res.ok) form.reset();
      } catch {
        if (feedbackEl) {
          feedbackEl.textContent = 'Errore di rete. Riprova.';
          feedbackEl.className = 'p-3 rounded bg-red-50 text-red-700 text-sm mt-2';
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  });
</script>
```

- [ ] **Step 4.2: Esegui build per verificare nessun errore**

```bash
npm run build
```

Expected: build completata senza errori TypeScript.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/forms/FormRenderer.astro
git commit -m "feat(forms): add FormRenderer Astro component"
```

---

## Task 5: API Endpoint POST /api/form/[slug]

**Files:**
- Create: `src/pages/api/form/[slug].ts`

- [ ] **Step 5.1: Crea `src/pages/api/form/[slug].ts`**

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getForm, saveSubmission, containsBlockedKeyword, sendNotificationEmail } from '../../../lib/forms';
import { detectCountry, extractClientIp } from '../../../lib/geo';

export const prerender = false;

// Silent reject: risponde 200 OK ma non salva nulla — i bot non sanno di essere bloccati
function silentReject() {
  return new Response(
    JSON.stringify({ success: true, message: 'Grazie per il tuo messaggio.' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function jsonError(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug) return jsonError('Slug mancante', 400);

  // ── Step 1: Fetch config form ──────────────────────────────────────────────
  const form = await getForm(slug);
  if (!form) return jsonError('Form non trovato', 404);

  // ── Step 2: Parse body ─────────────────────────────────────────────────────
  let bodyData: Record<string, string>;
  try {
    const formData = await request.formData();
    bodyData = Object.fromEntries(
      [...formData.entries()].map(([k, v]) => [k, String(v)])
    );
  } catch {
    return jsonError('Body non valido', 400);
  }

  // ── Step 3: Honeypot ───────────────────────────────────────────────────────
  if (form.honeypot_enabled && bodyData['_hp_field']) {
    return silentReject();
  }

  // ── Step 4: Country filter ────────────────────────────────────────────────
  const clientIp = extractClientIp(request);
  const country = await detectCountry(request, clientIp);

  if (form.country_filter_enabled && form.allowed_countries && form.allowed_countries.length > 0) {
    if (country && !form.allowed_countries.includes(country)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Service not available in your region.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ── Step 5: reCAPTCHA ─────────────────────────────────────────────────────
  if (form.recaptcha_enabled) {
    const token = bodyData['_recaptcha_token'];
    const secret = import.meta.env.RECAPTCHA_SECRET_KEY;
    if (!token || !secret) return jsonError('reCAPTCHA token mancante', 400);

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${token}`,
    });
    const verifyData = await verifyRes.json() as { success: boolean; score?: number };
    if (!verifyData.success || (verifyData.score ?? 1) < 0.5) {
      return jsonError('Verifica reCAPTCHA fallita. Riprova.', 400);
    }
  }

  // ── Step 6: Validazione Zod ───────────────────────────────────────────────
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  for (const field of form.fields) {
    if (field.type === 'checkbox') {
      schemaShape[field.name] = field.required
        ? z.literal('on', { errorMap: () => ({ message: `${field.label} è obbligatorio` }) })
        : z.string().optional();
    } else {
      schemaShape[field.name] = field.required
        ? z.string({ required_error: `${field.label} è obbligatorio` }).min(1, `${field.label} è obbligatorio`)
        : z.string().optional();
    }
  }
  const schema = z.object(schemaShape);

  // Estrai solo i campi del form (esclude campi interni _hp_field, _recaptcha_token, _page_url)
  const fieldNames = form.fields.map(f => f.name);
  const userDataRaw = Object.fromEntries(
    Object.entries(bodyData).filter(([k]) => fieldNames.includes(k))
  );

  const parsed = schema.safeParse(userDataRaw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Dati non validi';
    return jsonError(firstError, 422);
  }

  const userData = parsed.data as Record<string, unknown>;

  // ── Step 7: Keyword filter ────────────────────────────────────────────────
  if (form.keyword_filter_enabled && form.blocked_keywords && form.blocked_keywords.length > 0) {
    if (containsBlockedKeyword(userData, form.blocked_keywords)) {
      return silentReject();
    }
  }

  // ── Step 8: Salva submission ──────────────────────────────────────────────
  const pageUrl = form.capture_page_url ? (bodyData['_page_url'] ?? null) : null;
  const ipAddress = form.capture_ip ? clientIp : null;
  const userAgent = form.capture_user_agent ? (request.headers.get('user-agent') ?? null) : null;

  try {
    await saveSubmission(form.id, {
      data: userData,
      page_url: pageUrl,
      ip_address: ipAddress,
      user_agent: userAgent,
      country_code: country,
      is_read: false,
      form_id: form.id,
    });
  } catch (e) {
    console.error('Errore salvataggio submission:', e);
    return jsonError('Errore interno. Riprova.', 500);
  }

  // ── Step 9: Email notifica admin ──────────────────────────────────────────
  if (form.notification_email) {
    sendNotificationEmail({
      to: form.notification_email,
      formName: form.name,
      data: userData,
      pageUrl,
      country,
      ipAddress,
      userAgent,
      submittedAt: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
    }).catch(e => console.error('Errore invio email notifica:', e));
  }

  // ── Risposta ──────────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({
      success: true,
      redirect: form.redirect_enabled && !!form.redirect_url,
      message: form.success_message ?? 'Grazie per il tuo messaggio!',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
```

- [ ] **Step 5.2: Verifica TypeScript**

```bash
npx astro check
```

Expected: 0 errori.

- [ ] **Step 5.3: Esegui tutti i test**

```bash
npm test
```

Expected: tutti i test passano.

- [ ] **Step 5.4: Commit**

```bash
git add src/pages/api/form/
git commit -m "feat(forms): add form submission API endpoint with anti-spam pipeline"
```

---

## Task 6: Aggiorna package.json e .env.example

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 6.1: Aggiungi variabili d'ambiente a `.env.example`**

Apri `.env.example` e aggiungi in fondo:

```bash
# reCAPTCHA v3 (opzionale — solo se form ha recaptcha_enabled=true)
RECAPTCHA_SECRET_KEY=
PUBLIC_RECAPTCHA_SITE_KEY=

# Geo filter provider (default: ip-api)
# Opzioni: ip-api | maxmind | cloudflare
GEO_PROVIDER=ip-api

# Internal endpoint secret (per flow-kpi-nightly)
INTERNAL_SECRET=cambia-con-stringa-casuale-sicura
```

- [ ] **Step 6.2: Commit finale**

```bash
git add .env.example package-lock.json
git commit -m "feat(forms): update env example with Forms and Geo vars"
```

---

## Checklist Finale Piano 3

- [ ] `npm test` — tutti i test passano
- [ ] `npx astro check` — 0 errori TypeScript
- [ ] `npm run build` — build completata
- [ ] `node --check scripts/setup-forms-collections.mjs` — nessun errore
- [ ] Test manuale: crea form in Directus → aggiungi `<FormRenderer slug="test" />` a una pagina → verifica submit

**Uso del componente:**
```astro
---
import FormRenderer from '../components/forms/FormRenderer.astro';
---
<FormRenderer slug="contattaci" />
```

**Prossimo step:** Eseguire `setup:all` su Directus, configurare i Flows (Piano 2), creare i form in Directus Admin.
