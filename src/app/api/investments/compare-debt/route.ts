import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { z } from 'zod';
import { compareDebtVsInvest } from '@/lib/investment-engine';
import type { InvestmentInput } from '@/lib/investment-engine';
import type { DebtInput } from '@/lib/payoff-engine/types';

const compareSchema = z.object({
  extra_amounts_cents: z.array(z.number().int().min(0)).min(1).max(5),
  investment_return_bps: z.number().int().optional().default(700),
  tax_status: z.enum(['taxable', 'tax_deferred', 'tax_free']).optional().default('taxable'),
  tax_rate_bps: z.number().int().min(0).max(10000).optional().default(2500),
  inflation_rate_bps: z.number().int().min(0).max(10000).optional().default(300),
  years: z.number().int().min(1).max(50).optional().default(10),
});

export async function POST(request: Request) {
  try {
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = compareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      extra_amounts_cents,
      investment_return_bps,
      tax_status,
      tax_rate_bps,
      inflation_rate_bps,
      years,
    } = parsed.data;

    // Fetch user's debts
    const supabase = await createClient();

    const { data: debts, error } = await supabase
      .from('debts')
      .select('*')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    if (error) {
      console.error('Error fetching debts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch debts' },
        { status: 500 }
      );
    }

    if (!debts || debts.length === 0) {
      return NextResponse.json(
        { error: 'No debts found to compare against' },
        { status: 400 }
      );
    }

    // Convert to DebtInput format
    const debtInputs: DebtInput[] = debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance_cents: d.balance_cents,
      apr_bps: d.apr_bps,
      min_payment_cents: d.min_payment_cents,
    }));

    // Create investment input for comparison
    const investmentInput: InvestmentInput = {
      id: 'comparison',
      name: 'Investment Comparison',
      initial_balance_cents: 0,
      monthly_contribution_cents: 0, // Will be set per scenario
      annual_return_bps: investment_return_bps,
      tax_status,
      tax_rate_bps,
      inflation_rate_bps,
    };

    const result = compareDebtVsInvest(
      debtInputs,
      investmentInput,
      extra_amounts_cents,
      years
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
