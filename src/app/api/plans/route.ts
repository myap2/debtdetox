import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { buildPlanSnapshot } from '@/lib/plan-snapshot';
import { z } from 'zod';

const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  strategy: z.enum(['snowball', 'avalanche']),
  extra_payment_cents: z.number().int().min(0).optional().default(0),
});

export async function GET() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('plans')
      .select(
        'id, name, strategy, extra_payment_cents, is_active, created_at, updated_at, plan_snapshots(id, total_interest_cents, debt_free_date, created_at)'
      )
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching plans:', error);
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
    }

    // Reduce each plan's snapshots to the most recent summary
    const plans = (data ?? []).map((plan) => {
      const snapshots = [...(plan.plan_snapshots ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = snapshots[0] ?? null;
      return {
        id: plan.id,
        name: plan.name,
        strategy: plan.strategy,
        extra_payment_cents: plan.extra_payment_cents,
        is_active: plan.is_active,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
        total_interest_cents: latest?.total_interest_cents ?? null,
        debt_free_date: latest?.debt_free_date ?? null,
        snapshot_created_at: latest?.created_at ?? null,
      };
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

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

    const snapshot = buildPlanSnapshot(
      debts,
      parsed.data.strategy,
      parsed.data.extra_payment_cents
    );

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        owner_type: session.type,
        owner_id: session.id,
        name: parsed.data.name,
        strategy: parsed.data.strategy,
        extra_payment_cents: parsed.data.extra_payment_cents,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error('Error creating plan:', planError);
      return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
    }

    const { error: snapshotError } = await supabase.from('plan_snapshots').insert({
      plan_id: plan.id,
      snapshot_json: snapshot,
      total_interest_cents: snapshot.result.total_interest_cents,
      debt_free_date: snapshot.result.debt_free_date.split('T')[0],
    });

    if (snapshotError) {
      // A plan without its snapshot is useless — roll it back.
      await supabase.from('plans').delete().eq('id', plan.id);
      console.error('Error creating plan snapshot:', snapshotError);
      return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
    }

    await logActivity(session, 'plan_saved', {
      plan_id: plan.id,
      plan_name: plan.name,
      strategy: plan.strategy,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
