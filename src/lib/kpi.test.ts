import { describe, it, expect } from 'vitest';
import {
  calculateClv,
  calculateChurnScore,
  calculateLeadScore,
  calculateRfmSegment,
  calculatePreferredChannel,
  calculateAvgOrderValue,
} from './kpi';

describe('calculateClv', () => {
  it('restituisce 0 se non ci sono ordini', () => {
    expect(calculateClv({ totalSpent: 0, totalOrders: 0, daysSinceFirstOrder: 0 })).toBe(0);
  });

  it('calcola CLV annualizzato correttamente', () => {
    // avg = 100, freq = 12 ordini in 365gg = ~1/mese, clv annuale = 100 * 12 = 1200
    const clv = calculateClv({ totalSpent: 1200, totalOrders: 12, daysSinceFirstOrder: 365 });
    expect(clv).toBeCloseTo(1200, 0);
  });

  it('gestisce cliente con un solo ordine recente', () => {
    const clv = calculateClv({ totalSpent: 200, totalOrders: 1, daysSinceFirstOrder: 10 });
    expect(clv).toBeGreaterThan(0);
  });
});

describe('calculateChurnScore', () => {
  it('restituisce 90 per cliente senza acquisti da 181+ giorni', () => {
    expect(calculateChurnScore({ daysSinceLastPurchase: 200, totalOrders: 1 })).toBe(90);
  });

  it('riduce sotto 10 per cliente fedele con acquisto recente', () => {
    expect(calculateChurnScore({ daysSinceLastPurchase: 10, totalOrders: 3 })).toBe(8);
  });

  it('riduce il punteggio per clienti con molti ordini', () => {
    const score5 = calculateChurnScore({ daysSinceLastPurchase: 100, totalOrders: 5 });
    const score1 = calculateChurnScore({ daysSinceLastPurchase: 100, totalOrders: 1 });
    expect(score5).toBeLessThan(score1);
  });

  it('non supera 100', () => {
    const score = calculateChurnScore({ daysSinceLastPurchase: 999, totalOrders: 0 });
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateRfmSegment', () => {
  it('champions: acquisto recente, alta frequenza, alto valore', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 10, totalOrders: 8, totalSpent: 2000 })).toBe('champions');
  });

  it('dormant: nessun acquisto da 180+ giorni', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 200, totalOrders: 2, totalSpent: 200 })).toBe('dormant');
  });

  it('new: primo acquisto recente', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 5, totalOrders: 1, totalSpent: 100 })).toBe('new');
  });

  it('at_risk: buona storia ma inattivo 90+ giorni', () => {
    expect(calculateRfmSegment({ daysSinceLastPurchase: 100, totalOrders: 4, totalSpent: 800 })).toBe('at_risk');
  });
});

describe('calculatePreferredChannel', () => {
  it('restituisce offline se ordini offline > online', () => {
    expect(calculatePreferredChannel({ onlineOrders: 2, offlineOrders: 5 })).toBe('offline');
  });

  it('restituisce online se ordini online > offline', () => {
    expect(calculatePreferredChannel({ onlineOrders: 7, offlineOrders: 1 })).toBe('online');
  });

  it('restituisce offline in caso di parità', () => {
    expect(calculatePreferredChannel({ onlineOrders: 3, offlineOrders: 3 })).toBe('offline');
  });
});

describe('calculateAvgOrderValue', () => {
  it('restituisce 0 se non ci sono ordini', () => {
    expect(calculateAvgOrderValue({ totalSpent: 0, totalOrders: 0 })).toBe(0);
  });

  it('calcola la media correttamente', () => {
    expect(calculateAvgOrderValue({ totalSpent: 300, totalOrders: 3 })).toBe(100);
  });
});

describe('calculateLeadScore', () => {
  it('lead: base score 20', () => {
    expect(calculateLeadScore({ pipelineStage: 'lead', daysSinceLastInteraction: 30, totalInteractions: 1 })).toBe(20);
  });

  it('cliente_attivo: base score 80', () => {
    expect(calculateLeadScore({ pipelineStage: 'cliente_attivo', daysSinceLastInteraction: 30, totalInteractions: 1 })).toBe(80);
  });

  it('stage sconosciuto: fallback a 20', () => {
    expect(calculateLeadScore({ pipelineStage: 'unknown', daysSinceLastInteraction: 30, totalInteractions: 1 })).toBe(20);
  });

  it('interazione recente (+20) porta il punteggio più alto', () => {
    const withRecent = calculateLeadScore({ pipelineStage: 'lead', daysSinceLastInteraction: 5, totalInteractions: 1 });
    const withoutRecent = calculateLeadScore({ pipelineStage: 'lead', daysSinceLastInteraction: 30, totalInteractions: 1 });
    expect(withRecent).toBe(withoutRecent + 20);
  });

  it('molte interazioni (+10) porta il punteggio più alto', () => {
    const withMany = calculateLeadScore({ pipelineStage: 'lead', daysSinceLastInteraction: 30, totalInteractions: 3 });
    const withFew = calculateLeadScore({ pipelineStage: 'lead', daysSinceLastInteraction: 30, totalInteractions: 1 });
    expect(withMany).toBe(withFew + 10);
  });

  it('score non supera 100', () => {
    expect(calculateLeadScore({ pipelineStage: 'cliente_fidelizzato', daysSinceLastInteraction: 3, totalInteractions: 5 })).toBeLessThanOrEqual(100);
  });
});
