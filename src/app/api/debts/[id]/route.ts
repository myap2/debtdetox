import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { z } from 'zod';

const updateDebtSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['credit_card', 'student_loan', 'mortgage', 'auto', 'personal', 'medical', 'other']).optional(),
  balance_cents: z.number().int().min(0).optional(),
  apr_bps: z.number().int().min(0).optional(),
  min_payment_cents: z.number().int().min(0).optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
    }

    return NextResponse.json(data);
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

    const parsed = updateDebtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // First verify ownership
    const { data: existing } = await supabase
      .from('debts')
      .select('id')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('debts')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating debt:', error);
      return NextResponse.json({ error: 'Failed to update debt' }, { status: 500 });
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

    // First verify ownership
    const { data: existing } = await supabase
      .from('debts')
      .select('id')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting debt:', error);
      return NextResponse.json({ error: 'Failed to delete debt' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
