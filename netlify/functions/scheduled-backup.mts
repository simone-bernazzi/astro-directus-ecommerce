// netlify/functions/scheduled-backup.mts
// Triggered automatically by Netlify Scheduled Functions
// Schedule is defined in backup.config.mjs (activeSchedule field)
//
// Deploy: this file is auto-discovered by Netlify as a scheduled function
// Manual trigger: POST /api/admin/backup with BACKUP_ADMIN_KEY header

import type { Config, Context } from '@netlify/functions'

export default async (_req: Request, _ctx: Context): Promise<Response> => {
  const siteUrl = process.env.URL ?? process.env.PUBLIC_SITE_URL
  const adminKey = process.env.BACKUP_ADMIN_KEY

  if (!siteUrl) {
    console.error('[scheduled-backup] URL env var not set')
    return new Response('Missing URL', { status: 500 })
  }

  if (!adminKey) {
    console.error('[scheduled-backup] BACKUP_ADMIN_KEY not set — skipping')
    return new Response('Missing BACKUP_ADMIN_KEY', { status: 500 })
  }

  const type = process.env.BACKUP_TYPE ?? 'daily'

  try {
    const res = await fetch(`${siteUrl}/api/admin/backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ type }),
    })

    const body = await res.text()
    if (!res.ok) {
      console.error(`[scheduled-backup] API returned ${res.status}: ${body}`)
      return new Response(body, { status: res.status })
    }

    console.log(`[scheduled-backup] Completed: ${body}`)
    return new Response(body, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[scheduled-backup] Error: ${msg}`)
    return new Response(msg, { status: 500 })
  }
}

// Schedule is read from backup.config.mjs at deploy time.
// To change it, update activeSchedule in backup.config.mjs and redeploy.
export const config: Config = {
  schedule: process.env.BACKUP_CRON ?? '@daily',
}
