#!/usr/bin/env node
// scripts/restore.mjs
// Ripristina un backup Directus creato con backup.mjs
//
// Usage:
//   node scripts/restore.mjs <backup-path>           → ripristina tutto
//   node scripts/restore.mjs <backup-path> --dry-run → mostra cosa verrebbe fatto
//   node scripts/restore.mjs <backup-path> --schema-only   → solo schema
//   node scripts/restore.mjs <backup-path> --data-only     → solo dati
//   node scripts/restore.mjs <backup-path> --collection products → solo una collezione

import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, extname, basename } from 'node:path'
import { execSync } from 'node:child_process'

// ── Load .env ────────────────────────────────────────────────────────────────

try {
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
} catch { /* usa variabili di sistema */ }

// ── CLI args ─────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2)
const backupPath  = args.find(a => !a.startsWith('--'))
const dryRun      = args.includes('--dry-run')
const schemaOnly  = args.includes('--schema-only')
const dataOnly    = args.includes('--data-only')
const onlyCol     = args[args.indexOf('--collection') + 1] ?? null

if (!backupPath) {
  console.error('✗ Specificare il percorso del backup\n  Uso: node scripts/restore.mjs <backup-path>')
  process.exit(1)
}

const DIRECTUS_URL   = process.env.DIRECTUS_URL?.replace(/\/$/, '')
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('✗ DIRECTUS_URL e DIRECTUS_TOKEN sono richiesti nel .env')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function api(path, method = 'GET', body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Directus ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function importBatch(collection, items) {
  const batchSize = 50
  let imported = 0
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await api(`/items/${collection}`, 'POST', batch)
    imported += batch.length
    process.stdout.write(`\r    ${imported}/${items.length} items...`)
  }
  process.stdout.write('\n')
  return imported
}

// ── Extract archive if needed ─────────────────────────────────────────────────

async function getBackupDir(inputPath) {
  const abs = resolve(inputPath)

  if (!existsSync(abs)) {
    throw new Error(`Percorso non trovato: ${abs}`)
  }

  // If it's a .tar.gz, extract to a temp dir
  if (extname(abs) === '.gz' || abs.endsWith('.tar.gz')) {
    const tmpDir = abs.replace(/\.tar\.gz$/, '') + '_extracted'
    if (!existsSync(tmpDir)) {
      console.log('  → Estrazione archivio...')
      mkdirSync(tmpDir, { recursive: true })
      execSync(`tar -xzf "${abs}" -C "${tmpDir}"`, { stdio: 'pipe' })
      // tar creates a subdirectory with the backup name
      const { readdirSync } = await import('node:fs')
      const entries = readdirSync(tmpDir)
      if (entries.length === 1) return join(tmpDir, entries[0])
      return tmpDir
    }
    return tmpDir
  }

  return abs
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔄 Restore Directus')
  if (dryRun) console.log('  (dry-run: nessuna modifica verrà applicata)\n')

  const backupDir = await getBackupDir(backupPath)

  // Read manifest
  const manifestPath = join(backupDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest.json non trovato in ${backupDir}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  console.log(`  Backup:    ${manifest.type} — ${manifest.timestamp}`)
  console.log(`  Sorgente:  ${manifest.directusUrl}`)
  console.log(`  Destinaz.: ${DIRECTUS_URL}`)
  console.log(`  Collezioni: ${manifest.collections?.length ?? 0} (${manifest.totalItems ?? 0} items)`)

  if (!dryRun) {
    // Confirm before destructive operation
    if (!args.includes('--force')) {
      const { createInterface } = await import('node:readline')
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise(r => rl.question('\n  ⚠ Questa operazione sovrascriverà i dati esistenti. Continuare? (yes/no): ', r))
      rl.close()
      if (answer.toLowerCase() !== 'yes') {
        console.log('  Operazione annullata.')
        process.exit(0)
      }
    }
  }

  // 1. Restore schema
  if (!dataOnly) {
    const schemaPath = join(backupDir, 'schema.json')
    if (existsSync(schemaPath)) {
      console.log('\n  → Applicazione schema...')
      if (!dryRun) {
        const snapshot = JSON.parse(readFileSync(schemaPath, 'utf8'))
        // Calculate diff first
        const diff = await api('/schema/diff', 'POST', snapshot.data ?? snapshot)
        if (diff.data?.hash) {
          await api('/schema/apply', 'POST', diff.data)
          console.log('    ✓ Schema applicato')
        } else {
          console.log('    ✓ Schema già aggiornato (nessuna differenza)')
        }
      } else {
        console.log('    (dry-run) schema.json trovato')
      }
    }
  }

  // 2. Restore settings
  const settingsPath = join(backupDir, 'settings.json')
  if (!dataOnly && existsSync(settingsPath)) {
    console.log('  → Ripristino settings...')
    if (!dryRun) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
      await api('/settings', 'PATCH', settings.data ?? settings)
      console.log('    ✓ Settings aggiornati')
    } else {
      console.log('    (dry-run) settings.json trovato')
    }
  }

  // 3. Restore collections
  if (!schemaOnly) {
    const collectionsDir = join(backupDir, 'collections')
    if (!existsSync(collectionsDir)) {
      console.log('  ⚠ Directory collections/ non trovata nel backup')
    } else {
      const { readdirSync } = await import('node:fs')
      const files = readdirSync(collectionsDir).filter(f => f.endsWith('.json'))
      const toRestore = onlyCol
        ? files.filter(f => f === `${onlyCol}.json`)
        : files

      if (onlyCol && toRestore.length === 0) {
        throw new Error(`Collezione non trovata nel backup: ${onlyCol}`)
      }

      console.log(`\n  → Ripristino dati (${toRestore.length} collezioni)...`)

      for (const file of toRestore) {
        const colName = file.replace('.json', '')
        const colData = JSON.parse(readFileSync(join(collectionsDir, file), 'utf8'))
        const items   = colData.data ?? []

        if (items.length === 0) {
          console.log(`    · ${colName}: vuota`)
          continue
        }

        process.stdout.write(`    → ${colName} (${items.length} items)... `)

        if (!dryRun) {
          try {
            const count = await importBatch(colName, items)
            console.log(`✓ ${count} items importati`)
          } catch (e) {
            console.log(`⚠ ${e.message}`)
          }
        } else {
          console.log(`(dry-run)`)
        }
      }
    }
  }

  console.log('\n✓ Restore completato!\n')
}

main().catch(err => {
  console.error('\n✗ Restore fallito:', err.message)
  process.exit(1)
})
