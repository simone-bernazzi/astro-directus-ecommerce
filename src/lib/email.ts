// src/lib/email.ts — transactional email helpers
export interface EmailOrderItem {
  product_name: string
  variant_name: string
  sku: string
  unit_price: number
  quantity: number
  download_token: string | null
}

export interface EmailOrder {
  id: string
  customer_email: string
  customer_name: string
  subtotal: number
  discount_amount: number
  shipping_cost: number
  total: number
  shipping_address?: {
    name: string
    line1: string
    line2?: string | null
    city: string
    postal_code: string
    state?: string
    country: string
  } | null
  tracking_number?: string | null
  tracking_url?: string | null
}

function fmt(n: number) {
  return `€${n.toFixed(2)}`
}

function siteName() {
  return process.env.SMTP_FROM_NAME ?? 'Il nostro negozio'
}

function siteUrl() {
  return process.env.PUBLIC_SITE_URL ?? ''
}

function year() {
  return new Date().getFullYear()
}

function baseTemplate(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

<!-- header -->
<tr><td style="background:#111827;padding:28px 40px;text-align:center;">
<span style="color:#ffffff;font-size:20px;font-weight:700;">${siteName()}</span>
</td></tr>

<!-- body -->
<tr><td style="padding:40px 40px 32px;">
${content}
</td></tr>

<!-- footer -->
<tr><td style="background:#f4f4f5;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#6b7280;font-size:12px;">© ${year()} ${siteName()} · Hai domande? Rispondiamo a <a href="mailto:${process.env.SMTP_FROM ?? ''}" style="color:#6b7280;">${process.env.SMTP_FROM ?? ''}</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function itemsTable(items: EmailOrderItem[]) {
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;">
        <strong>${i.product_name}</strong>${i.variant_name ? `<br><span style="color:#6b7280;font-size:12px;">${i.variant_name}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;text-align:center;color:#6b7280;">×${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;text-align:right;white-space:nowrap;">${fmt(i.unit_price * i.quantity)}</td>
    </tr>`).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <th style="text-align:left;padding-bottom:8px;font-size:12px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;">Prodotto</th>
      <th style="text-align:center;padding-bottom:8px;font-size:12px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;">Qtà</th>
      <th style="text-align:right;padding-bottom:8px;font-size:12px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;">Prezzo</th>
    </tr>
    ${rows}
  </table>`
}

function totalsBlock(order: EmailOrder) {
  const rows = [
    `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Subtotale</td><td style="padding:4px 0;text-align:right;font-size:14px;">${fmt(order.subtotal)}</td></tr>`,
  ]
  if (order.discount_amount > 0) {
    rows.push(`<tr><td style="padding:4px 0;color:#16a34a;font-size:14px;">Sconto</td><td style="padding:4px 0;text-align:right;color:#16a34a;font-size:14px;">-${fmt(order.discount_amount)}</td></tr>`)
  }
  rows.push(`<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Spedizione</td><td style="padding:4px 0;text-align:right;font-size:14px;">${order.shipping_cost === 0 ? 'Gratuita' : fmt(order.shipping_cost)}</td></tr>`)
  rows.push(`<tr><td style="padding:12px 0 4px;font-weight:700;font-size:16px;border-top:2px solid #111827;">Totale</td><td style="padding:12px 0 4px;text-align:right;font-weight:700;font-size:16px;border-top:2px solid #111827;">${fmt(order.total)}</td></tr>`)

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${rows.join('')}</table>`
}

function shippingBlock(addr: NonNullable<EmailOrder['shipping_address']>) {
  const lines = [addr.name, addr.line1, addr.line2, `${addr.postal_code} ${addr.city}`, addr.state, addr.country]
    .filter(Boolean).join('<br>')
  return `<div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:6px;">
    <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;color:#6b7280;font-weight:700;">Indirizzo di spedizione</p>
    <p style="margin:0;font-size:14px;line-height:1.6;">${lines}</p>
  </div>`
}

function downloadBlock(items: EmailOrderItem[]) {
  const digitalItems = items.filter(i => i.download_token)
  if (digitalItems.length === 0) return ''

  const links = digitalItems.map(i => {
    const url = `${siteUrl()}/api/download/${i.download_token}`
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;">${i.product_name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
        <a href="${url}" style="display:inline-block;padding:6px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Scarica</a>
      </td>
    </tr>`
  }).join('')

  return `<div style="margin:28px 0;padding:20px;background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;">
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1d4ed8;">📥 I tuoi download</p>
    <p style="margin:0 0 16px;font-size:13px;color:#3b82f6;">I link sono disponibili per un periodo limitato. Salva i file sul tuo dispositivo dopo il download.</p>
    <table width="100%" cellpadding="0" cellspacing="0">${links}</table>
  </div>`
}

export function renderOrderConfirmation(order: EmailOrder, items: EmailOrderItem[]): string {
  const hasDigital = items.some(i => i.download_token)
  const hasShipping = !!order.shipping_address

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">Grazie per il tuo ordine! 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Ciao <strong>${order.customer_name || 'cliente'}</strong>, abbiamo ricevuto il tuo ordine e stiamo già lavorando per te.</p>

    <div style="background:#f9fafb;border-radius:6px;padding:14px 18px;margin-bottom:24px;font-size:14px;">
      <strong>Numero ordine:</strong> <span style="font-family:monospace;">#${order.id}</span>
    </div>

    ${itemsTable(items)}
    ${totalsBlock(order)}
    ${hasShipping && order.shipping_address ? shippingBlock(order.shipping_address) : ''}
    ${hasDigital ? downloadBlock(items) : ''}

    ${hasShipping && !hasDigital ? '<p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Riceverai un\'email con il numero di tracking non appena il tuo pacco sarà spedito.</p>' : ''}
  `

  return baseTemplate(`Conferma ordine #${order.id}`, content)
}

export function renderShippingNotification(order: EmailOrder): string {
  const hasTracking = !!order.tracking_number

  const trackingBlock = hasTracking ? `
    <div style="margin:24px 0;padding:20px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#16a34a;">📦 Numero di tracking</p>
      <p style="margin:0 0 12px;font-family:monospace;font-size:16px;letter-spacing:1px;">${order.tracking_number}</p>
      ${order.tracking_url
        ? `<a href="${order.tracking_url}" style="display:inline-block;padding:8px 18px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:600;">Traccia la spedizione →</a>`
        : ''}
    </div>` : `<p style="margin:16px 0;font-size:14px;color:#6b7280;">Riceverai aggiornamenti sulla consegna direttamente dal corriere.</p>`

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">Il tuo ordine è in arrivo! 🚚</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Ciao <strong>${order.customer_name || 'cliente'}</strong>, il tuo ordine è stato spedito e arriverà presto.</p>

    <div style="background:#f9fafb;border-radius:6px;padding:14px 18px;margin-bottom:24px;font-size:14px;">
      <strong>Numero ordine:</strong> <span style="font-family:monospace;">#${order.id}</span>
    </div>

    ${trackingBlock}

    ${order.shipping_address ? shippingBlock(order.shipping_address) : ''}
  `

  return baseTemplate(`Spedizione ordine #${order.id}`, content)
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST
  const smtpFrom = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const fromName = process.env.SMTP_FROM_NAME ?? siteName()

  if (!smtpHost || !smtpFrom || !to) return

  const nodemailer = await import('nodemailer').catch(() => null)
  if (!nodemailer) return

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })

  await transporter.sendMail({
    from: `"${fromName}" <${smtpFrom}>`,
    to,
    subject,
    html,
  })
}

export function renderRestockNotification(productName: string, productUrl: string): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">Il prodotto è di nuovo disponibile! 🎉</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Ottima notizia! Il prodotto che stavi aspettando è tornato disponibile.</p>

    <div style="margin:24px 0;padding:20px;background:#f9fafb;border-radius:6px;text-align:center;">
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;">${productName}</p>
      <a href="${productUrl}" style="display:inline-block;padding:12px 28px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">Acquista ora →</a>
    </div>

    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">Non vuoi più ricevere queste notifiche? Ignora questa email — non ti invieremo altri avvisi per questo prodotto.</p>
  `
  return baseTemplate(`${productName} è di nuovo disponibile`, content)
}

export async function sendRestockNotification(to: string, productName: string, productUrl: string): Promise<void> {
  if (!to) return
  try {
    const html = renderRestockNotification(productName, productUrl)
    await sendMail(to, `${productName} è di nuovo disponibile — ${siteName()}`, html)
  } catch (err) {
    console.error('[email] sendRestockNotification failed:', err)
  }
}

export async function sendOrderConfirmation(order: EmailOrder, items: EmailOrderItem[]): Promise<void> {
  if (!order.customer_email) return
  try {
    const html = renderOrderConfirmation(order, items)
    await sendMail(order.customer_email, `Conferma ordine #${order.id} — ${siteName()}`, html)
  } catch (err) {
    console.error('[email] sendOrderConfirmation failed:', err)
  }
}

export async function sendShippingNotification(order: EmailOrder): Promise<void> {
  if (!order.customer_email) return
  try {
    const html = renderShippingNotification(order)
    await sendMail(order.customer_email, `Il tuo ordine #${order.id} è stato spedito — ${siteName()}`, html)
  } catch (err) {
    console.error('[email] sendShippingNotification failed:', err)
  }
}
