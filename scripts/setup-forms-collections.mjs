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
