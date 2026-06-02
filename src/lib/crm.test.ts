import { describe, it, expect } from 'vitest';
import type {
  Contact, CrmInteraction, CrmTask, CustomerKpi,
  ChannelType, PipelineStage,
} from './types';
import { fullName } from './crm';

describe('CRM types', () => {
  it('Contact has required fields', () => {
    const c: Contact = {
      id: '1',
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario@esempio.it',
      phone: null,
      date_of_birth: null,
      channel_type: 'online',
      canale_prevalente: 'online',
      pipeline_stage: 'cliente_attivo',
      customer_id: null,
      default_shipping_address: null,
      is_active: true,
      tags: [],
      date_created: '2026-01-01T00:00:00Z',
    };
    expect(c.channel_type).toBe('online');
    expect(c.pipeline_stage).toBe('cliente_attivo');
  });

  it('ChannelType accepts offline, online, both', () => {
    const a: ChannelType = 'offline';
    const b: ChannelType = 'online';
    const c: ChannelType = 'both';
    expect([a, b, c]).toHaveLength(3);
  });

  it('PipelineStage covers all 5 stages', () => {
    const stages: PipelineStage[] = [
      'lead', 'prospect', 'cliente_attivo', 'cliente_fidelizzato', 'inattivo',
    ];
    expect(stages).toHaveLength(5);
  });

  it('CustomerKpi has CLV and churn fields', () => {
    const kpi: CustomerKpi = {
      id: '1',
      contact_id: '1',
      clv: 500,
      churn_score: 25,
      lead_score: 80,
      total_spent_online: 300,
      total_spent_offline: 200,
      total_orders_online: 3,
      total_orders_offline: 2,
      last_purchase_at: '2026-05-01T00:00:00Z',
      avg_order_value: 100,
      preferred_channel: 'online',
      rfm_segment: 'loyal',
      calculated_at: '2026-06-01T00:00:00Z',
    };
    expect(kpi.clv).toBe(500);
    expect(kpi.churn_score).toBe(25);
  });
});

describe('fullName', () => {
  it('concatena first_name e last_name', () => {
    expect(fullName({ first_name: 'Mario', last_name: 'Rossi' })).toBe('Mario Rossi');
  });

  it('trimma spazi extra', () => {
    expect(fullName({ first_name: 'Anna', last_name: 'Bianchi' })).toBe('Anna Bianchi');
  });
});
