'use client';

import { useQuery } from '@tanstack/react-query';
import type { DebtVsInvestResult, TaxStatus } from '@/lib/investment-engine';

interface CompareOptions {
  extra_amounts_cents: number[];
  investment_return_bps?: number;
  tax_status?: TaxStatus;
  tax_rate_bps?: number;
  inflation_rate_bps?: number;
  years?: number;
}

async function fetchComparison(options: CompareOptions): Promise<DebtVsInvestResult> {
  const response = await fetch('/api/investments/compare-debt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to compare debt vs invest');
  }

  return response.json();
}

export function useDebtVsInvest(options: CompareOptions | null) {
  return useQuery({
    queryKey: ['debtVsInvest', options],
    queryFn: () => fetchComparison(options!),
    enabled: !!options && options.extra_amounts_cents.length > 0,
  });
}
