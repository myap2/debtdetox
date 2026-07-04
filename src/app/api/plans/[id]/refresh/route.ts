import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { buildPlanSnapshot } from '@/lib/plan-snapshot';

/**
 * Recomputes a saved plan's snapshot using the user's current debt balances
 * ("Update using current balances"). Inserts a new snapshot so the previous
 * one is kept as history.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (plan.strategy !== 'snowball' && plan.strategy !== 'avalanche') {
      return NextResponse.json(
        { error: 'Only snowball and avalanche plans can be refreshed' },
        { status: 400 }
      );
    }

    const { data: debts, error: debtsError } = await supabase
      .from('debts')
      .select('id, name, type, balance_cents, apr_bps, min_payment_cents')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    if (debtsError) {
      console.error('Error fetching debts:', debtsError);
      return NextResponse.json({ error: 'Failed to fetch debts' }, { status: 500 });
    }

    if (!debts || debts.length === 0) {
      return NextResponse.json({ error: 'No debts found' }, { status: 400 });
    }

    const snapshot = buildPlanSnapshot(debts, plan.strategy, plan.extra_payment_cents);

    const { data: newSnapshot, error: snapshotError } = await supabase
      .from('plan_snapshots')
      .insert({
        plan_id: plan.id,
        snapshot_json: snapshot,
        total_interest_cents: snapshot.result.total_interest_cents,
        debt_free_date: snapshot.result.debt_free_date.split('T')[0],
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('Error refreshing plan snapshot:', snapshotError);
      return NextResponse.json({ error: 'Failed to refresh plan' }, { status: 500 });
    }

    return NextResponse.json({ ...plan, snapshot: newSnapshot });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
