// backup.config.mjs — Configurazione centralizzata backup
// Modifica questo file per ogni progetto cliente

export default {
  // ── Schedule (usato dalla Netlify Function) ────────────────────────────────
  schedule: {
    // Sintassi cron UTC. Valori rapidi: @daily @weekly @monthly
    daily:   '0 2 * * *',    // ogni giorno alle 02:00 UTC
    weekly:  '0 2 * * 0',    // domenica alle 02:00 UTC
    monthly: '0 2 1 * *',    // primo del mese alle 02:00 UTC
  },

  // Quale schedule attivare nella Netlify Function ('daily' | 'weekly' | 'monthly')
  activeSchedule: 'daily',

  // ── Retention ──────────────────────────────────────────────────────────────
  retention: {
    daily:   7,   // tieni gli ultimi N backup giornalieri
    weekly:  4,   // tieni gli ultimi N backup settimanali
    monthly: 3,   // tieni gli ultimi N backup mensili
  },

  // ── Collections ────────────────────────────────────────────────────────────
  collections: {
    // Collezioni Directus da escludere (pattern glob o nome esatto)
    exclude: [
      'directus_activity',
      'directus_sessions',
      'directus_revisions',
      'directus_webhooks',
      'directus_notifications',
    ],
    // Includi anche le impostazioni singleton di Directus
    includeSystemSettings: true,
    // Scarica anche i file binari (può essere molto pesante — usa con cautela)
    includeFiles: false,
  },

  // ── Storage ────────────────────────────────────────────────────────────────
  storage: {
    // 'local' = salva in localPath  |  's3' = carica su S3-compatible
    type: process.env.BACKUP_STORAGE ?? 'local',
    localPath: process.env.BACKUP_LOCAL_PATH ?? './backups',
    s3: {
      endpoint:  process.env.BACKUP_S3_ENDPOINT  ?? '',   // es. https://s3.eu-central-1.amazonaws.com
      bucket:    process.env.BACKUP_S3_BUCKET    ?? '',
      region:    process.env.BACKUP_S3_REGION    ?? 'eu-central-1',
      accessKey: process.env.BACKUP_S3_ACCESS_KEY ?? '',
      secretKey: process.env.BACKUP_S3_SECRET_KEY ?? '',
      prefix:    process.env.BACKUP_S3_PREFIX    ?? 'backups/', // cartella dentro il bucket
    },
  },
}
