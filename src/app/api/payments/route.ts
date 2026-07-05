import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { z } from 'zod';

const createPaymentSchema = z.object({
  debt_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date is required'),
  note: z.string().max(500).nullable().optional(),
  // Set after the user confirms a payment larger than the remaining balance.
  allow_overpayment: z.boolean().optional().default(false),
});

export async function GET(request: Request) {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const debtId = searchParams.get('debt_id');

    let query = supabase
      .from('payments')
      .select('*')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .order('paid_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (debtId) {
      query = query.eq('debt_id', debtId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
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

    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify the debt belongs to the current owner
    const { data: debt } = await supabase
      .from('debts')
      .select('id, name, balance_cents')
      .eq('id', parsed.data.debt_id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!debt) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
    }

    const { amount_cents, allow_overpayment } = parsed.data;

    if (amount_cents > debt.balance_cents && !allow_overpayment) {
      return NextResponse.json(
        {
          error: 'Payment exceeds remaining balance',
          code: 'EXCEEDS_BALANCE',
          remaining_balance_cents: debt.balance_cents,
        },
        { status: 422 }
      );
    }

    // Only reduce the balance by what is actually owed; record the applied
    // delta so edits/deletes can restore the balance exactly.
    const balanceDelta = Math.min(amount_cents, debt.balance_cents);

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        owner_type: session.type,
        owner_id: session.id,
        debt_id: parsed.data.debt_id,
        amount_cents,
        balance_delta_cents: balanceDelta,
        note: parsed.data.note ?? null,
        paid_at: parsed.data.paid_at,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment:', error);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    const { error: balanceError } = await supabase
      .from('debts')
      .update({ balance_cents: debt.balance_cents - balanceDelta })
      .eq('id', debt.id);

    if (balanceError) {
      // Roll back the payment so we never leave a payment recorded without
      // its balance adjustment.
      await supabase.from('payments').delete().eq('id', payment.id);
      console.error('Error updating debt balance:', balanceError);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    await logActivity(session, 'payment_recorded', {
      payment_id: payment.id,
      debt_id: debt.id,
      debt_name: debt.name,
      amount_cents,
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
