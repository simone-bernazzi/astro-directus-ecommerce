import {
  createDirectus, rest, staticToken,
  readItems, readItem, createItem, updateItem,
} from '@directus/sdk';
import type {
  Contact, CrmInteraction, CrmTask, CrmTag,
  CustomerKpi, CrmPipelineHistory,
  PipelineStage,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>

function getEnv(key: string): string {
  return (
    (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown> & { env?: Record<string, string> }).env?.[key]) ||
    process.env[key] ||
    ''
  )
}

function getClient() {
  const url = getEnv('DIRECTUS_URL')
  const token = getEnv('DIRECTUS_TOKEN')
  if (!url) throw new Error('DIRECTUS_URL not configured.')
  let client = createDirectus<Schema>(url).with(rest())
  if (token) client = client.with(staticToken(token)) as typeof client
  return client
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(options?: {
  pipelineStage?: PipelineStage;
  channelType?: 'offline' | 'online' | 'both';
  isActive?: boolean;
  limit?: number;
}): Promise<Contact[]> {
  const filter: Record<string, unknown> = {};
  if (options?.isActive !== undefined) filter.is_active = { _eq: options.isActive };
  if (options?.pipelineStage) filter.pipeline_stage = { _eq: options.pipelineStage };
  if (options?.channelType) filter.channel_type = { _eq: options.channelType };

  const items = await getClient().request(
    readItems('contacts', {
      filter,
      fields: ['*', { tags: ['*'] }],
      sort: ['last_name', 'first_name'],
      limit: options?.limit ?? -1,
    })
  );
  return items as Contact[];
}

export async function getContact(id: string): Promise<Contact | null> {
  try {
    const item = await getClient().request(
      readItem('contacts', id, {
        fields: ['*', { tags: ['*'] }],
      })
    );
    return item as Contact;
  } catch {
    return null;
  }
}

export async function getContactByEmail(email: string): Promise<Contact | null> {
  const items = await getClient().request(
    readItems('contacts', {
      filter: { email: { _eq: email } },
      fields: ['*', { tags: ['*'] }],
      limit: 1,
    })
  );
  return (items as Contact[])[0] ?? null;
}

export async function createContact(data: Omit<Contact, 'id' | 'date_created' | 'tags'>): Promise<Contact> {
  const item = await client.request(createItem('contacts', data));
  return item as Contact;
}

export async function updateContactPipelineStage(
  id: string,
  stage: PipelineStage
): Promise<Contact> {
  const item = await client.request(updateItem('contacts', id, { pipeline_stage: stage }));
  return item as Contact;
}

export async function updateContactChannelType(
  id: string,
  channelType: 'offline' | 'online' | 'both'
): Promise<Contact> {
  const item = await client.request(updateItem('contacts', id, { channel_type: channelType }));
  return item as Contact;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

export async function getInteractionsByContact(contactId: string): Promise<CrmInteraction[]> {
  const items = await getClient().request(
    readItems('crm_interactions', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      sort: ['-date'],
    })
  );
  return items as CrmInteraction[];
}

export async function createInteraction(
  data: Omit<CrmInteraction, 'id'>
): Promise<CrmInteraction> {
  const item = await client.request(createItem('crm_interactions', data));
  return item as CrmInteraction;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasksByContact(contactId: string): Promise<CrmTask[]> {
  const items = await getClient().request(
    readItems('crm_tasks', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      sort: ['due_date'],
    })
  );
  return items as CrmTask[];
}

export async function getTasksDueToday(): Promise<CrmTask[]> {
  const today = new Date().toISOString().split('T')[0];
  const items = await getClient().request(
    readItems('crm_tasks', {
      filter: {
        due_date: { _between: [`${today}T00:00:00`, `${today}T23:59:59.999`] },
        status: { _in: ['pending', 'in_progress'] },
      },
      fields: ['*'],
      sort: ['due_date'],
    })
  );
  return items as CrmTask[];
}

export async function createTask(data: Omit<CrmTask, 'id'>): Promise<CrmTask> {
  const item = await client.request(createItem('crm_tasks', data));
  return item as CrmTask;
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export async function getKpiByContact(contactId: string): Promise<CustomerKpi | null> {
  const items = await getClient().request(
    readItems('customer_kpis', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      limit: 1,
    })
  );
  return (items as CustomerKpi[])[0] ?? null;
}

export async function getContactsAtRisk(churnThreshold = 70): Promise<CustomerKpi[]> {
  const items = await getClient().request(
    readItems('customer_kpis', {
      filter: { churn_score: { _gte: churnThreshold } },
      fields: ['*'],
      sort: ['-churn_score'],
    })
  );
  return items as CustomerKpi[];
}

// ─── Pipeline History ────────────────────────────────────────────────────────

export async function getPipelineHistory(contactId: string): Promise<CrmPipelineHistory[]> {
  const items = await getClient().request(
    readItems('crm_pipeline_history', {
      filter: { contact_id: { _eq: contactId } },
      fields: ['*'],
      sort: ['-date'],
    })
  );
  return items as CrmPipelineHistory[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fullName(contact: Pick<Contact, 'first_name' | 'last_name'>): string {
  return `${contact.first_name} ${contact.last_name}`.trim();
}
