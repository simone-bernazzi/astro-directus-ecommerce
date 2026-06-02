export interface ClvInput {
  totalSpent: number;
  totalOrders: number;
  daysSinceFirstOrder: number;
}

export interface ChurnInput {
  daysSinceLastPurchase: number;
  totalOrders: number;
}

export interface RfmInput {
  daysSinceLastPurchase: number;
  totalOrders: number;
  totalSpent: number;
}

export type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'dormant' | 'new' | 'other';

export function calculateClv({ totalSpent, totalOrders, daysSinceFirstOrder }: ClvInput): number {
  if (totalOrders === 0 || totalSpent === 0) return 0;
  const avgOrderValue = totalSpent / totalOrders;
  const daysActive = Math.max(daysSinceFirstOrder, 1);
  const ordersPerYear = (totalOrders / daysActive) * 365;
  return Math.round(avgOrderValue * ordersPerYear * 100) / 100;
}

export function calculateChurnScore({ daysSinceLastPurchase, totalOrders }: ChurnInput): number {
  let score: number;
  if (daysSinceLastPurchase > 180) score = 90;
  else if (daysSinceLastPurchase > 90) score = 60;
  else if (daysSinceLastPurchase > 60) score = 40;
  else if (daysSinceLastPurchase > 30) score = 20;
  else score = 10;

  if (totalOrders >= 6) score = Math.round(score * 0.6);
  else if (totalOrders >= 3) score = Math.round(score * 0.8);

  return Math.min(100, Math.max(10, score));
}

export function calculateLeadScore({
  pipelineStage,
  daysSinceLastInteraction,
  totalInteractions,
}: {
  pipelineStage: string;
  daysSinceLastInteraction: number;
  totalInteractions: number;
}): number {
  const stageScore: Record<string, number> = {
    lead: 20,
    prospect: 50,
    cliente_attivo: 80,
    cliente_fidelizzato: 90,
    inattivo: 10,
  };
  let score = stageScore[pipelineStage] ?? 20;
  if (daysSinceLastInteraction <= 7) score = Math.min(100, score + 20);
  if (totalInteractions >= 3) score = Math.min(100, score + 10);
  return score;
}

export function calculateRfmSegment({ daysSinceLastPurchase, totalOrders, totalSpent }: RfmInput): RfmSegment {
  if (daysSinceLastPurchase > 180) return 'dormant';
  if (totalOrders === 1 && daysSinceLastPurchase <= 30) return 'new';
  if (daysSinceLastPurchase <= 30 && totalOrders >= 5 && totalSpent >= 500) return 'champions';
  if (totalOrders >= 5) return 'loyal';
  if (daysSinceLastPurchase > 90 && totalOrders >= 2) return 'at_risk';
  return 'other';
}

export function calculatePreferredChannel({
  onlineOrders,
  offlineOrders,
}: {
  onlineOrders: number;
  offlineOrders: number;
}): 'online' | 'offline' {
  return onlineOrders > offlineOrders ? 'online' : 'offline';
}

export function calculateAvgOrderValue({
  totalSpent,
  totalOrders,
}: {
  totalSpent: number;
  totalOrders: number;
}): number {
  if (totalOrders === 0) return 0;
  return Math.round((totalSpent / totalOrders) * 100) / 100;
}
