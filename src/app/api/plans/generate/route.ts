import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { calculatePayoff, compareStrategies } from '@/lib/payoff-engine';
import type { DebtInput, PayoffStrategy } from '@/lib/payoff-engine';
import { z } from 'zod';

const generatePlanSchema = z.object({
  strategy: z.enum(['snowball', 'avalanche']).optional(),
  extra_payment_cents: z.number().int().min(0).optional().default(0),
  compare: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = generatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch user's debts
    const { data: debts, error } = await supabase
      .from('debts')
      .select('id, name, balance_cents, apr_bps, min_payment_cents')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    if (error) {
      console.error('Error fetching debts:', error);
      return NextResponse.json({ error: 'Failed to fetch debts' }, { status: 500 });
    }

    if (!debts || debts.length === 0) {
      return NextResponse.json({ error: 'No debts found' }, { status: 400 });
    }

    const debtInputs: DebtInput[] = debts.map((d) => ({
      id: d.id,
      name: d.name,
      balance_cents: d.balance_cents,
      apr_bps: d.apr_bps,
      min_payment_cents: d.min_payment_cents,
    }));

    if (parsed.data.compare) {
      // Return comparison of both strategies
      const comparison = compareStrategies(debtInputs, parsed.data.extra_payment_cents);
      return NextResponse.json(comparison);
    }

    // Calculate single strategy
    const strategy: PayoffStrategy = parsed.data.strategy || 'avalanche';
    const result = calculatePayoff(debtInputs, strategy, parsed.data.extra_payment_cents);

    return NextResponse.json({
      strategy,
      extra_payment_cents: parsed.data.extra_payment_cents,
      ...result,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
