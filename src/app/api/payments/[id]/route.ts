import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { z } from 'zod';

const updatePaymentSchema = z.object({
  amount_cents: z.number().int().positive().optional(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(500).nullable().optional(),
  allow_overpayment: z.boolean().optional().default(false),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = updatePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.paid_at !== undefined) updates.paid_at = parsed.data.paid_at;
    if (parsed.data.note !== undefined) updates.note = parsed.data.note;

    let debtName: string | null = null;

    // Changing the amount means re-applying the payment against the debt:
    // restore the previously applied delta, then apply the new amount.
    if (
      parsed.data.amount_cents !== undefined &&
      parsed.data.amount_cents !== payment.amount_cents
    ) {
      const { data: debt } = await supabase
        .from('debts')
        .select('id, name, balance_cents')
        .eq('id', payment.debt_id)
        .single();

      if (!debt) {
        return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
      }

      debtName = debt.name;
      const restoredBalance = debt.balance_cents + payment.balance_delta_cents;
      const newAmount = parsed.data.amount_cents;

      if (newAmount > restoredBalance && !parsed.data.allow_overpayment) {
        return NextResponse.json(
          {
            error: 'Payment exceeds remaining balance',
            code: 'EXCEEDS_BALANCE',
            remaining_balance_cents: restoredBalance,
          },
          { status: 422 }
        );
      }

      const newDelta = Math.min(newAmount, restoredBalance);

      const { error: balanceError } = await supabase
        .from('debts')
        .update({ balance_cents: restoredBalance - newDelta })
        .eq('id', debt.id);

      if (balanceError) {
        console.error('Error updating debt balance:', balanceError);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
      }

      updates.amount_cents = newAmount;
      updates.balance_delta_cents = newDelta;
    }

    const { data: updated, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment:', error);
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }

    await logActivity(session, 'payment_updated', {
      payment_id: id,
      debt_id: payment.debt_id,
      debt_name: debtName,
      amount_cents: updated.amount_cents,
    });

    return NextResponse.json(updated);
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

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const { error } = await supabase.from('payments').delete().eq('id', id);

    if (error) {
      console.error('Error deleting payment:', error);
      return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
    }

    // Restore the exact amount this payment reduced the balance by. The debt
    // may have been deleted since (payments cascade), so a missing debt is fine.
    const { data: debt } = await supabase
      .from('debts')
      .select('id, name, balance_cents')
      .eq('id', payment.debt_id)
      .single();

    if (debt) {
      const { error: balanceError } = await supabase
        .from('debts')
        .update({ balance_cents: debt.balance_cents + payment.balance_delta_cents })
        .eq('id', debt.id);

      if (balanceError) {
        console.error('Error restoring debt balance:', balanceError);
        return NextResponse.json(
          { error: 'Payment deleted but balance could not be restored' },
          { status: 500 }
        );
      }
    }

    await logActivity(session, 'payment_deleted', {
      payment_id: id,
      debt_id: payment.debt_id,
      debt_name: debt?.name ?? null,
      amount_cents: payment.amount_cents,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
