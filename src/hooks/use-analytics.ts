'use client';

import { useQuery } from '@tanstack/react-query';
import type { MonthlyPaymentPoint, BalancePoint, PaymentStats } from '@/lib/analytics';

export interface AnalyticsData extends PaymentStats {
  interest_saved_cents: number;
  payoff_percentage: number;
  current_total_balance_cents: number;
  monthly_payments: MonthlyPaymentPoint[];
  balance_history: BalancePoint[];
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch('/api/analytics');
  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }
  return response.json();
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
  });
}
