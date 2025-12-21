import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { z } from 'zod';

const createDebtSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['credit_card', 'student_loan', 'mortgage', 'auto', 'personal', 'medical', 'other']),
  balance_cents: z.number().int().min(0),
  apr_bps: z.number().int().min(0),
  min_payment_cents: z.number().int().min(0),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
});

export async function GET() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching debts:', error);
      return NextResponse.json({ error: 'Failed to fetch debts' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = createDebtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('debts')
      .insert({
        owner_type: session.type,
        owner_id: session.id,
        name: parsed.data.name,
        type: parsed.data.type,
        balance_cents: parsed.data.balance_cents,
        apr_bps: parsed.data.apr_bps,
        min_payment_cents: parsed.data.min_payment_cents,
        due_day: parsed.data.due_day ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating debt:', error);
      return NextResponse.json({ error: 'Failed to create debt' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
