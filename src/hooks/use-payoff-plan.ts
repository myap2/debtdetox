'use client';

import { useQuery } from '@tanstack/react-query';
import type { PayoffResult, PayoffStrategy } from '@/lib/payoff-engine';

interface ComparisonResult {
  snowball: PayoffResult;
  avalanche: PayoffResult;
  savings_cents: number;
  faster_strategy: PayoffStrategy;
  months_saved: number;
}

interface GeneratePlanOptions {
  compare?: boolean;
  extra_payment_cents?: number;
}

async function generatePlan(options: GeneratePlanOptions): Promise<ComparisonResult> {
  const response = await fetch('/api/plans/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate plan');
  }

  return response.json();
}

export function usePayoffPlan(extraPaymentCents: number = 0) {
  return useQuery({
    queryKey: ['payoffPlan', extraPaymentCents],
    queryFn: () => generatePlan({ compare: true, extra_payment_cents: extraPaymentCents }),
    retry: false,
  });
}
