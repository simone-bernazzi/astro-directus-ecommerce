#!/usr/bin/env node
// scripts/backup.mjs
// Usage:
//   node scripts/backup.mjs                  → backup giornaliero
//   node scripts/backup.mjs --type weekly    → backup settimanale
//   node scripts/backup.mjs --type monthly   → backup mensile
//   node scripts/backup.mjs --dry-run        → mostra cosa verrebbe fatto
//
// Richiede DIRECTUS_URL e DIRECTUS_TOKEN nel .env

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHmac, createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

// ── Load .env ────────────────────────────────────────────────────────────────

try {
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
} catch { /* .env non presente — usa variabili di sistema */ }

const config = (await import('../backup.config.mjs')).default

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const typeArg  = args[args.indexOf('--type') + 1] ?? 'daily'
const dryRun   = args.includes('--dry-run')
const backupType = ['daily', 'weekly', 'monthly'].includes(typeArg) ? typeArg : 'daily'

// ── Directus helpers ─────────────────────────────────────────────────────────

const DIRECTUS_URL   = process.env.DIRECTUS_URL?.replace(/\/$/, '')
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('✗ DIRECTUS_URL e DIRECTUS_TOKEN sono richiesti nel .env')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' }

async function api(path, method = 'GET', body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Directus API ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function fetchAll(collection, fields = '*') {
  const pageSize = 200
  let offset = 0
  const items = []
  while (true) {
    const { data } = await api(
      `/items/${collection}?limit=${pageSize}&offset=${offset}&fields=${fields}&sort=id`
    )
    if (!Array.isArray(data) || data.length === 0) break
    items.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return items
}

// ── S3 upload (AWS Sig v4, no external deps) ──────────────────────────────────

function hmacSha256(key, data) {
  return createHmac('sha256', key).update(data).digest()
}
function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

async function uploadToS3(key, body, s3cfg) {
  const { endpoint, bucket, region, accessKey, secretKey, prefix } = s3cfg
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    console.warn('  ⚠ S3 non configurato — salto upload remoto')
    return
  }

  const s3Key = `${prefix}${key}`
  const host  = endpoint.replace(/^https?:\/\//, '')
  const url   = `https://${host}/${bucket}/${s3Key}`

  const now      = new Date()
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '')
  const datetime = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')

  const bodyBuf    = Buffer.isBuffer(body) ? body : Buffer.from(body)
  const bodyHash   = sha256Hex(bodyBuf)
  const canonHdrs  = `host:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${datetime}\n`
  const signedHdrs = 'host;x-amz-content-sha256;x-amz-date'
  const canonical  = ['PUT', `/${bucket}/${s3Key}`, '', canonHdrs, signedHdrs, bodyHash].join('\n')

  const credScope  = `${date}/${region}/s3/aws4_request`
  const strToSign  = `AWS4-HMAC-SHA256\n${datetime}\n${credScope}\n${sha256Hex(canonical)}`

  const kDate    = hmacSha256(`AWS4${secretKey}`, date)
  const kRegion  = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, 's3')
  const kSign    = hmacSha256(kService, 'aws4_request')
  const sig      = hmacSha256(kSign, strToSign).toString('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHdrs}, Signature=${sig}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'x-amz-date': datetime,
      'x-amz-content-sha256': bodyHash,
      'Content-Type': 'application/gzip',
      'Content-Length': String(bodyBuf.length),
    },
    body: bodyBuf,
  })

  if (!res.ok) throw new Error(`S3 upload failed: ${res.status} ${await res.text()}`)
  console.log(`  ✓ Caricato su S3: ${s3Key}`)
}

// ── Retention ─────────────────────────────────────────────────────────────────

function applyRetention(localPath, type, keep) {
  try {
    const prefix = `${type}-`
    const dirs = readdirSync(localPath)
      .filter(d => d.startsWith(prefix))
      .map(d => ({ name: d, mtime: statSync(join(localPath, d)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime)

    const toDelete = dirs.slice(keep)
    for (const { name } of toDelete) {
      console.log(`  🗑  Rimozione backup scaduto: ${name}`)
      if (!dryRun) rmSync(join(localPath, name), { recursive: true, force: true })
    }
  } catch (e) {
    console.warn(`  ⚠ Retention policy: ${e.message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now       = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupName = `${backupType}-${timestamp}`
  const localPath  = resolve(config.storage.localPath)
  const backupDir  = join(localPath, backupName)

  console.log(`\n🗂  Backup Directus — ${backupType.toUpperCase()} — ${timestamp}`)
  if (dryRun) console.log('  (dry-run: nessun file verrà scritto)\n')

  if (!dryRun) mkdirSync(backupDir, { recursive: true })

  const manifest = {
    version: '1.0',
    type: backupType,
    timestamp: now.toISOString(),
    directusUrl: DIRECTUS_URL,
    collections: [],
    filesCount: 0,
    totalItems: 0,
  }

  // 1. Schema snapshot
  console.log('  → Esportazione schema...')
  if (!dryRun) {
    const schema = await api('/schema/snapshot')
    writeFileSync(join(backupDir, 'schema.json'), JSON.stringify(schema, null, 2))
  }
  console.log('    ✓ schema.json')

  // 2. System settings
  if (config.collections.includeSystemSettings) {
    console.log('  → Esportazione settings...')
    if (!dryRun) {
      const settings = await api('/settings')
      writeFileSync(join(backupDir, 'settings.json'), JSON.stringify(settings, null, 2))
    }
    console.log('    ✓ settings.json')
  }

  // 3. Collections list
  console.log('  → Recupero lista collezioni...')
  const { data: allCollections } = await api('/collections')
  const excluded = new Set(config.collections.exclude)
  const userCollections = allCollections
    .map(c => c.collection)
    .filter(name => !name.startsWith('directus_') && !excluded.has(name))

  console.log(`    ✓ ${userCollections.length} collezioni trovate: ${userCollections.join(', ')}`)

  // 4. Export each collection
  if (!dryRun) mkdirSync(join(backupDir, 'collections'), { recursive: true })

  for (const col of userCollections) {
    process.stdout.write(`  → ${col}... `)
    if (!dryRun) {
      const items = await fetchAll(col)
      writeFileSync(
        join(backupDir, 'collections', `${col}.json`),
        JSON.stringify({ collection: col, count: items.length, data: items }, null, 2)
      )
      manifest.collections.push({ name: col, count: items.length })
      manifest.totalItems += items.length
      console.log(`✓ (${items.length} items)`)
    } else {
      console.log('(dry-run)')
    }
  }

  // 5. Files metadata
  console.log('  → Esportazione metadati file...')
  if (!dryRun) {
    const files = await fetchAll('directus_files', 'id,filename_download,title,type,filesize,uploaded_on,folder')
    writeFileSync(join(backupDir, 'files.json'), JSON.stringify({ count: files.length, data: files }, null, 2))
    manifest.filesCount = files.length
    console.log(`    ✓ files.json (${files.length} file)`)

    // 5b. Download file binaries (optional)
    if (config.collections.includeFiles && files.length > 0) {
      const filesDir = join(backupDir, 'files')
      mkdirSync(filesDir, { recursive: true })
      console.log(`  → Download file binari (${files.length})...`)
      let downloaded = 0
      for (const file of files) {
        try {
          const res = await fetch(`${DIRECTUS_URL}/assets/${file.id}`, { headers })
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer())
            writeFileSync(join(filesDir, file.filename_download), buf)
            downloaded++
          }
        } catch { /* singolo file fallito — continua */ }
      }
      console.log(`    ✓ ${downloaded}/${files.length} file scaricati`)
    }
  } else {
    console.log('    (dry-run)')
  }

  // 6. Write manifest
  if (!dryRun) {
    writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  }

  // 7. Create tar.gz archive
  let archivePath = null
  if (!dryRun) {
    const tarPath = `${backupDir}.tar.gz`
    try {
      execSync(`tar -czf "${tarPath}" -C "${localPath}" "${backupName}"`, { stdio: 'pipe' })
      rmSync(backupDir, { recursive: true })
      archivePath = tarPath
      console.log(`  ✓ Archivio: ${tarPath}`)
    } catch {
      // tar non disponibile — lascia la directory
      archivePath = backupDir
      console.log(`  ✓ Directory: ${backupDir} (tar non disponibile)`)
    }
  }

  // 8. Upload to S3 (if configured)
  if (!dryRun && config.storage.type === 's3' && archivePath) {
    console.log('  → Upload S3...')
    try {
      const buf = readFileSync(archivePath)
      const s3Key = `${backupName}.tar.gz`
      await uploadToS3(s3Key, buf, config.storage.s3)
      // Rimuovi locale dopo upload S3 riuscito
      rmSync(archivePath, { recursive: true, force: true })
    } catch (e) {
      console.error(`  ✗ Upload S3 fallito: ${e.message}`)
    }
  }

  // 9. Retention policy
  if (!dryRun && config.storage.type === 'local') {
    applyRetention(localPath, backupType, config.retention[backupType])
  }

  // 10. Summary
  console.log('\n✓ Backup completato!')
  if (!dryRun) {
    console.log(`  Tipo:     ${backupType}`)
    console.log(`  Schema:   ✓`)
    console.log(`  Collezioni: ${manifest.collections.length} (${manifest.totalItems} items totali)`)
    console.log(`  File:     ${manifest.filesCount} metadati`)
    console.log(`  Percorso: ${archivePath ?? backupDir}`)
  }
  console.log()
}

main().catch(err => {
  console.error('\n✗ Backup fallito:', err.message)
  process.exit(1)
})
