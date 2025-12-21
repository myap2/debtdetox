'use client';

import { useQuery } from '@tanstack/react-query';
import type { InvestmentProjection, RetirementProjection, TaxStatus } from '@/lib/investment-engine';

interface ProjectionOptions {
  years: number;
  include_inflation?: boolean;
  include_taxes?: boolean;
  target_amount_cents?: number;
}

interface InlineInvestment {
  initial_balance_cents: number;
  monthly_contribution_cents: number;
  annual_return_bps: number;
  tax_status: TaxStatus;
  tax_rate_bps?: number;
  inflation_rate_bps?: number;
}

async function fetchProjection(
  investmentId: string | null,
  inlineInvestment: InlineInvestment | null,
  options: ProjectionOptions
): Promise<InvestmentProjection | RetirementProjection> {
  const body: Record<string, unknown> = {
    years: options.years,
    include_inflation: options.include_inflation ?? true,
    include_taxes: options.include_taxes ?? true,
  };

  if (investmentId) {
    body.investment_id = investmentId;
  } else if (inlineInvestment) {
    body.investment = inlineInvestment;
  }

  if (options.target_amount_cents) {
    body.target_amount_cents = options.target_amount_cents;
  }

  const response = await fetch('/api/investments/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Failed to calculate projection');
  }

  return response.json();
}

export function useInvestmentProjection(
  investmentId: string | null,
  options: ProjectionOptions
) {
  return useQuery({
    queryKey: ['investmentProjection', investmentId, options],
    queryFn: () => fetchProjection(investmentId, null, options),
    enabled: !!investmentId && options.years > 0,
  });
}

export function useQuickProjection(
  investment: InlineInvestment | null,
  options: ProjectionOptions
) {
  return useQuery({
    queryKey: ['quickProjection', investment, options],
    queryFn: () => fetchProjection(null, investment, options),
    enabled: !!investment && options.years > 0,
  });
}
