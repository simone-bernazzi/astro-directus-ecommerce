// src/pages/api/admin/backup.ts
// Protected endpoint to trigger a Directus backup programmatically.
// Called by the Netlify scheduled function or manually by an admin.
//
// POST /api/admin/backup
// Headers: x-admin-key: <BACKUP_ADMIN_KEY>
// Body:    { "type": "daily" | "weekly" | "monthly" }   (optional, default "daily")

export const prerender = false

import type { APIRoute } from 'astro'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const execFileAsync = promisify(execFile)

export const POST: APIRoute = async ({ request }) => {
  // Auth check
  const key = request.headers.get('x-admin-key')
  const expectedKey = import.meta.env.BACKUP_ADMIN_KEY

  if (!expectedKey) {
    return new Response(JSON.stringify({ error: 'BACKUP_ADMIN_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!key || key !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let type = 'daily'
  try {
    const body = await request.json()
    if (['daily', 'weekly', 'monthly'].includes(body?.type)) {
      type = body.type
    }
  } catch { /* default to daily */ }

  const scriptPath = resolve('scripts/backup.mjs')

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, '--type', type],
      { timeout: 5 * 60 * 1000 }
    )
    if (stderr) console.warn('[backup api]', stderr)

    return new Response(
      JSON.stringify({ ok: true, type, output: stdout }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[backup api] failed:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
