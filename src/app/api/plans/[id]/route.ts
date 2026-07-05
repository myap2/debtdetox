import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { z } from 'zod';

const updatePlanSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data: plan, error } = await supabase
      .from('plans')
      .select('*')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (error || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const { data: snapshots, error: snapshotError } = await supabase
      .from('plan_snapshots')
      .select('*')
      .eq('plan_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (snapshotError) {
      console.error('Error fetching plan snapshot:', snapshotError);
      return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 });
    }

    return NextResponse.json({ ...plan, snapshot: snapshots?.[0] ?? null });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('plans')
      .select('id')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('plans')
      .update({ name: parsed.data.name })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating plan:', error);
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('plans')
      .select('id, name')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const { error } = await supabase.from('plans').delete().eq('id', id);

    if (error) {
      console.error('Error deleting plan:', error);
      return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
    }

    await logActivity(session, 'plan_deleted', {
      plan_id: id,
      plan_name: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
