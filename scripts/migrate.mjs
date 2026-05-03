#!/usr/bin/env node
// scripts/migrate.mjs — Strumenti di migrazione progetto
//
// Comandi disponibili:
//
//  domain  → Aggiorna URL/dominio in tutto il contenuto Directus
//    node scripts/migrate.mjs domain --old vecchio.com --new nuovo.com
//    node scripts/migrate.mjs domain --old vecchio.com --new nuovo.com --dry-run
//
//  env     → Genera un nuovo .env da .env.example per un nuovo ambiente
//    node scripts/migrate.mjs env --source .env.old --output .env.new
//
//  checklist → Stampa la checklist completa di migrazione
//    node scripts/migrate.mjs checklist

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ── Load .env ────────────────────────────────────────────────────────────────

try {
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
} catch { /* usa variabili di sistema */ }

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIRECTUS_URL   = process.env.DIRECTUS_URL?.replace(/\/$/, '')
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN
const hdrs = { Authorization: `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' }

async function api(path, method = 'GET', body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method, headers: hdrs,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Directus ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function fetchAll(collection) {
  const pageSize = 200
  let offset = 0, items = []
  while (true) {
    const { data } = await api(`/items/${collection}?limit=${pageSize}&offset=${offset}&fields=*`)
    if (!Array.isArray(data) || !data.length) break
    items.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return items
}

// Replace old domain in any string or nested object
function replaceInValue(val, oldDomain, newDomain) {
  if (typeof val === 'string') {
    return val.replaceAll(oldDomain, newDomain)
  }
  if (Array.isArray(val)) {
    return val.map(v => replaceInValue(v, oldDomain, newDomain))
  }
  if (val && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, replaceInValue(v, oldDomain, newDomain)])
    )
  }
  return val
}

function hasOldDomain(val, oldDomain) {
  return JSON.stringify(val ?? '').includes(oldDomain)
}

// ── Command: domain ───────────────────────────────────────────────────────────

async function cmdDomain(args) {
  const oldDomain = args[args.indexOf('--old') + 1]
  const newDomain = args[args.indexOf('--new') + 1]
  const dryRun    = args.includes('--dry-run')

  if (!oldDomain || !newDomain) {
    console.error('✗ Uso: migrate.mjs domain --old vecchio.com --new nuovo.com')
    process.exit(1)
  }
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
    console.error('✗ DIRECTUS_URL e DIRECTUS_TOKEN sono richiesti nel .env')
    process.exit(1)
  }

  console.log(`\n🔄 Migrazione dominio`)
  console.log(`  Da: ${oldDomain}`)
  console.log(`  A:  ${newDomain}`)
  if (dryRun) console.log('  (dry-run: nessuna modifica)')

  // 1. Update Directus URL in settings
  console.log('\n  → Verifica settings...')
  try {
    const { data: settings } = await api('/settings')
    if (hasOldDomain(settings, oldDomain)) {
      const updated = replaceInValue(settings, oldDomain, newDomain)
      if (!dryRun) {
        await api('/settings', 'PATCH', updated)
        console.log('    ✓ settings aggiornati')
      } else {
        console.log('    [dry-run] settings contengono il vecchio dominio — verranno aggiornati')
      }
    } else {
      console.log('    · settings: nessuna occorrenza')
    }
  } catch (e) {
    console.warn(`    ⚠ settings: ${e.message}`)
  }

  // 2. Scan user collections
  const { data: allCollections } = await api('/collections')
  const userCols = allCollections
    .map(c => c.collection)
    .filter(n => !n.startsWith('directus_'))

  let totalUpdated = 0
  let totalSkipped = 0

  for (const col of userCols) {
    let items
    try {
      items = await fetchAll(col)
    } catch {
      console.log(`    · ${col}: skip (accesso negato o vuota)`)
      continue
    }

    const toUpdate = items.filter(item => hasOldDomain(item, oldDomain))

    if (toUpdate.length === 0) {
      totalSkipped++
      continue
    }

    console.log(`  → ${col}: ${toUpdate.length}/${items.length} items con il vecchio dominio`)

    if (!dryRun) {
      for (const item of toUpdate) {
        const updated = replaceInValue(item, oldDomain, newDomain)
        try {
          await api(`/items/${col}/${item.id}`, 'PATCH', updated)
          totalUpdated++
        } catch (e) {
          console.warn(`    ⚠ ${col}/${item.id}: ${e.message}`)
        }
      }
      console.log(`    ✓ ${toUpdate.length} aggiornati`)
    } else {
      console.log(`    [dry-run] ${toUpdate.length} verranno aggiornati`)
      totalUpdated += toUpdate.length
    }
  }

  // 3. Update file references
  try {
    const files = await fetchAll('directus_files')
    const toUpdate = files.filter(f => hasOldDomain(f, oldDomain))
    if (toUpdate.length > 0) {
      console.log(`  → directus_files: ${toUpdate.length} file con il vecchio dominio`)
      if (!dryRun) {
        for (const file of toUpdate) {
          const updated = replaceInValue(file, oldDomain, newDomain)
          await api(`/files/${file.id}`, 'PATCH', updated)
        }
        console.log(`    ✓ ${toUpdate.length} file aggiornati`)
      } else {
        console.log(`    [dry-run] ${toUpdate.length} file verranno aggiornati`)
      }
    }
  } catch (e) {
    console.warn(`  ⚠ files: ${e.message}`)
  }

  console.log(`\n✓ Migrazione dominio completata!`)
  console.log(`  Items aggiornati: ${totalUpdated}`)
  console.log(`  Passi manuali rimanenti:`)
  console.log(`    1. Aggiorna DIRECTUS_URL nel .env se Directus cambia host`)
  console.log(`    2. Aggiorna PUBLIC_SITE_URL e ALLOWED_ORIGIN nel .env Netlify`)
  console.log(`    3. Aggiorna il webhook Stripe con il nuovo URL`)
  console.log(`    4. Aggiorna il build hook Directus → Netlify`)
  console.log(`    5. Aggiorna il record DNS e attendi propagazione`)
  console.log()
}

// ── Command: env ──────────────────────────────────────────────────────────────

async function cmdEnv(args) {
  const sourceFile = args[args.indexOf('--source') + 1] ?? '.env'
  const outputFile = args[args.indexOf('--output') + 1] ?? '.env.new'

  const sourcePath = resolve(sourceFile)
  const outputPath = resolve(outputFile)

  if (!existsSync(sourcePath)) {
    // Use .env.example as fallback
    const examplePath = resolve('.env.example')
    if (!existsSync(examplePath)) {
      console.error(`✗ File sorgente non trovato: ${sourcePath}`)
      process.exit(1)
    }
    console.log(`  → Uso .env.example come sorgente`)
    writeFileSync(outputPath, readFileSync(examplePath, 'utf8'))
  } else {
    writeFileSync(outputPath, readFileSync(sourcePath, 'utf8'))
  }

  console.log(`\n📝 Generato: ${outputPath}`)
  console.log('\n  Variabili da aggiornare per il nuovo ambiente:')

  const criticalVars = [
    'DIRECTUS_URL',
    'DIRECTUS_TOKEN',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PUBLIC_SITE_URL',
    'ALLOWED_ORIGIN',
    'BACKUP_S3_BUCKET',
    'BACKUP_S3_ACCESS_KEY',
    'BACKUP_S3_SECRET_KEY',
    'PUBLIC_RECAPTCHA_SITE_KEY',
    'RECAPTCHA_SECRET_KEY',
  ]

  const content = readFileSync(outputPath, 'utf8')
  for (const v of criticalVars) {
    if (content.includes(v + '=')) {
      console.log(`    [ ] ${v}`)
    }
  }
  console.log(`\n  Apri ${outputFile}, aggiorna i valori e rinominalo in .env\n`)
}

// ── Command: checklist ────────────────────────────────────────────────────────

function cmdChecklist() {
  console.log(`
📋 Checklist completa migrazione progetto
==========================================

FASE 1 — Preparazione
  [ ] Backup completo sorgente: node scripts/backup.mjs
  [ ] Clona/fork il repo su GitHub
  [ ] Crea il nuovo .env: node scripts/migrate.mjs env --output .env.new

FASE 2 — Nuovo Directus (se cambia hosting)
  [ ] Installa Directus su nuovo cPanel/VPS
  [ ] Crea nuovo database MySQL
  [ ] Configura nuovo DIRECTUS_URL e DIRECTUS_TOKEN nel .env.new
  [ ] Applica schema: node scripts/restore.mjs <backup> --schema-only
  [ ] Importa dati (stesso dominio):
        node scripts/restore.mjs <backup> --data-only
  [ ] Importa dati (dominio diverso — sostituisce durante l'import):
        node scripts/restore.mjs <backup> --data-only --remap-domain vecchio.com:nuovo.com
  [ ] Verifica admin panel Directus sul nuovo host
  [ ] Configura permessi ruoli (Public, Customer, Admin)

FASE 3 — Nuovo dominio (se cambia, solo se NON usato --remap-domain)
  [ ] Aggiorna PUBLIC_SITE_URL e ALLOWED_ORIGIN nel .env.new
  [ ] Aggiorna contenuto già importato: node scripts/migrate.mjs domain --old vecchio.com --new nuovo.com
  [ ] Verifica immagini e link interni in Directus

FASE 4 — Stripe
  [ ] Crea nuovo webhook Stripe → nuovo URL
  [ ] Aggiorna STRIPE_WEBHOOK_SECRET nel .env.new
  [ ] Testa webhook con Stripe CLI: stripe listen --forward-to <nuovo-url>/api/webhook/stripe

FASE 5 — Netlify
  [ ] Crea nuovo sito Netlify o aggiorna le env vars
  [ ] Carica tutte le variabili del .env.new su Netlify
  [ ] Deploy manuale e verifica build
  [ ] Aggiorna build hook Directus → nuovo URL Netlify

FASE 6 — DNS
  [ ] Aggiorna record A/CNAME sul provider DNS
  [ ] Configura custom domain su Netlify
  [ ] Abilita HTTPS (auto su Netlify)
  [ ] Attendi propagazione DNS (max 48h)

FASE 7 — Verifica finale
  [ ] Homepage, negozio, PDP, carrello
  [ ] Flusso checkout completo (con carta di test Stripe)
  [ ] Download file digitali
  [ ] Form contatti (verifica email + Directus)
  [ ] Login account e storico ordini
  [ ] Backup automatico: verifica cron Netlify
`)
}

// ── Router ────────────────────────────────────────────────────────────────────

const [, , command, ...rest] = process.argv

switch (command) {
  case 'domain':
    await cmdDomain(rest)
    break
  case 'env':
    await cmdEnv(rest)
    break
  case 'checklist':
    cmdChecklist()
    break
  default:
    console.log(`
migrate.mjs — Strumenti migrazione Directus

Comandi:
  domain     Aggiorna il dominio in tutto il contenuto Directus
             node scripts/migrate.mjs domain --old vecchio.com --new nuovo.com [--dry-run]

  env        Genera un nuovo .env per un ambiente diverso
             node scripts/migrate.mjs env [--source .env.old] [--output .env.new]

  checklist  Mostra la checklist completa di migrazione
             node scripts/migrate.mjs checklist
`)
}
