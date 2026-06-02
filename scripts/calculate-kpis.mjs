// scripts/calculate-kpis.mjs
// Calcola KPI per tutti i contatti e aggiorna customer_kpis
// Usage: DIRECTUS_TOKEN=xxx node scripts/calculate-kpis.mjs
// Opzioni: --contact-id=xxx (ricalcola solo un contatto)

import { createDirectus, rest, staticToken, readItems, createItem, updateItem } from '@directus/sdk'
import {
  calculateClv,
  calculateChurnScore,
  calculateLeadScore,
  calculateRfmSegment,
  calculatePreferredChannel,
  calculateAvgOrderValue,
} from '../src/lib/kpi.js'

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? 'http://localhost:8055'
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN

if (!DIRECTUS_TOKEN) {
  console.error('Errore: DIRECTUS_TOKEN non impostato')
  process.exit(1)
}

const client = createDirectus(DIRECTUS_URL)
  .with(staticToken(DIRECTUS_TOKEN))
  .with(rest())

const targetContactId = process.argv.find(a => a.startsWith('--contact-id='))?.split('=')[1]

function daysBetween(dateStr) {
  if (!dateStr) return 9999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

async function fetchOrdersForContact(contactId) {
  return client.request(readItems('orders', {
    filter: { contact_id: { _eq: contactId }, status: { _in: ['paid', 'shipped', 'delivered'] } },
    fields: ['id', 'total', 'channel', 'date_created'],
    limit: -1,
  }))
}

async function fetchInteractionsForContact(contactId) {
  return client.request(readItems('crm_interactions', {
    filter: { contact_id: { _eq: contactId } },
    fields: ['id', 'date'],
    sort: ['-date'],
    limit: -1,
  }))
}

async function upsertKpi(contactId, kpiData) {
  const existing = await client.request(readItems('customer_kpis', {
    filter: { contact_id: { _eq: contactId } },
    fields: ['id'],
    limit: 1,
  }))

  if (existing.length > 0) {
    await client.request(updateItem('customer_kpis', existing[0].id, kpiData))
  } else {
    await client.request(createItem('customer_kpis', { contact_id: contactId, ...kpiData }))
  }
}

async function processContact(contact) {
  const orders = await fetchOrdersForContact(contact.id)
  const interactions = await fetchInteractionsForContact(contact.id)

  const onlineOrders = orders.filter(o => o.channel === 'online')
  const offlineOrders = orders.filter(o => o.channel === 'offline')

  const totalSpentOnline = onlineOrders.reduce((s, o) => s + Number(o.total), 0)
  const totalSpentOffline = offlineOrders.reduce((s, o) => s + Number(o.total), 0)
  const totalSpent = totalSpentOnline + totalSpentOffline
  const totalOrders = orders.length

  const sortedOrders = [...orders].sort((a, b) => new Date(a.date_created) - new Date(b.date_created))
  const firstOrderDate = sortedOrders[0]?.date_created ?? null
  const lastOrderDate = sortedOrders[sortedOrders.length - 1]?.date_created ?? null

  const daysSinceFirstOrder = daysBetween(firstOrderDate)
  const daysSinceLastPurchase = daysBetween(lastOrderDate)
  const lastInteractionDate = interactions[0]?.date ?? null
  const daysSinceLastInteraction = daysBetween(lastInteractionDate)

  const clv = calculateClv({ totalSpent, totalOrders, daysSinceFirstOrder })
  const churnScore = calculateChurnScore({ daysSinceLastPurchase, totalOrders })
  const leadScore = calculateLeadScore({
    pipelineStage: contact.pipeline_stage,
    daysSinceLastInteraction,
    totalInteractions: interactions.length,
  })
  const rfmSegment = calculateRfmSegment({ daysSinceLastPurchase, totalOrders, totalSpent })
  const preferredChannel = calculatePreferredChannel({
    onlineOrders: onlineOrders.length,
    offlineOrders: offlineOrders.length,
  })
  const avgOrderValue = calculateAvgOrderValue({ totalSpent, totalOrders })

  await upsertKpi(contact.id, {
    clv,
    churn_score: churnScore,
    lead_score: leadScore,
    total_spent_online: totalSpentOnline,
    total_spent_offline: totalSpentOffline,
    total_orders_online: onlineOrders.length,
    total_orders_offline: offlineOrders.length,
    last_purchase_at: lastOrderDate,
    avg_order_value: avgOrderValue,
    preferred_channel: preferredChannel,
    rfm_segment: rfmSegment,
    calculated_at: new Date().toISOString(),
  })
}

async function main() {
  console.log(`\nKPI Calculator → ${DIRECTUS_URL}`)
  if (targetContactId) console.log(`Modalità: singolo contatto (id: ${targetContactId})`)
  console.log()

  const filter = targetContactId
    ? { id: { _eq: targetContactId }, is_active: { _eq: true } }
    : { is_active: { _eq: true } }

  const contacts = await client.request(readItems('contacts', {
    filter,
    fields: ['id', 'pipeline_stage'],
    limit: -1,
  }))

  console.log(`Contatti da processare: ${contacts.length}\n`)

  let success = 0
  let errors = 0

  for (const contact of contacts) {
    try {
      await processContact(contact)
      console.log(`  ✓ contact ${contact.id}`)
      success++
    } catch (e) {
      console.error(`  ✗ contact ${contact.id}: ${e.message}`)
      errors++
    }
  }

  console.log(`\n✓ Completato: ${success} successi, ${errors} errori.`)
  if (errors > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
