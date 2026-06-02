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
  await field('contacts', 'directus_user_id', 'string', { is_nullable: true, is_unique: true }, { interface: 'input', hidden: true, note: 'FK → directus_users (account online)' })
  await field('contacts', 'stripe_customer_id', 'string', { is_nullable: true }, { interface: 'input', hidden: true })
  await field('contacts', 'shipping_addresses', 'json', { is_nullable: true }, { interface: 'input-code', options: { language: 'json' }, note: 'Array JSON di indirizzi: [{id,label,name,line1,line2,city,postal_code,country,is_default}]' })
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
  console.log('  1. Crea relazione M2O: contacts.directus_user_id → directus_users.id')
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
