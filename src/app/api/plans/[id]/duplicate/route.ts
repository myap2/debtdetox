import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { logActivity } from '@/lib/activity';

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

    const { data: snapshots } = await supabase
      .from('plan_snapshots')
      .select('*')
      .eq('plan_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    const snapshot = snapshots?.[0];
    if (!snapshot) {
      return NextResponse.json({ error: 'Plan has no snapshot to copy' }, { status: 400 });
    }

    const { data: copy, error: copyError } = await supabase
      .from('plans')
      .insert({
        owner_type: session.type,
        owner_id: session.id,
        name: `${plan.name} (copy)`,
        strategy: plan.strategy,
        extra_payment_cents: plan.extra_payment_cents,
      })
      .select()
      .single();

    if (copyError || !copy) {
      console.error('Error duplicating plan:', copyError);
      return NextResponse.json({ error: 'Failed to duplicate plan' }, { status: 500 });
    }

    const { error: snapshotError } = await supabase.from('plan_snapshots').insert({
      plan_id: copy.id,
      snapshot_json: snapshot.snapshot_json,
      total_interest_cents: snapshot.total_interest_cents,
      debt_free_date: snapshot.debt_free_date,
    });

    if (snapshotError) {
      await supabase.from('plans').delete().eq('id', copy.id);
      console.error('Error duplicating plan snapshot:', snapshotError);
      return NextResponse.json({ error: 'Failed to duplicate plan' }, { status: 500 });
    }

    await logActivity(session, 'plan_saved', {
      plan_id: copy.id,
      plan_name: copy.name,
      strategy: copy.strategy,
      duplicated_from: plan.id,
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
