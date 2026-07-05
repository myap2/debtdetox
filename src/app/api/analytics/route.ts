import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { calculatePayoff } from '@/lib/payoff-engine';
import type { DebtInput } from '@/lib/payoff-engine';
import {
  calculateBalanceHistory,
  calculateMonthlyPayments,
  calculatePaymentStats,
  calculatePayoffPercentage,
} from '@/lib/analytics';

export async function GET() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const [debtsResult, paymentsResult] = await Promise.all([
      supabase
        .from('debts')
        .select('id, name, balance_cents, apr_bps, min_payment_cents')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
      supabase
        .from('payments')
        .select('amount_cents, balance_delta_cents, paid_at')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
    ]);

    if (debtsResult.error || paymentsResult.error) {
      console.error('Error fetching analytics data:', debtsResult.error ?? paymentsResult.error);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }

    const debts = debtsResult.data ?? [];
    const payments = paymentsResult.data ?? [];

    const currentTotalBalance = debts.reduce((sum, d) => sum + d.balance_cents, 0);
    const totalBalanceDelta = payments.reduce((sum, p) => sum + p.balance_delta_cents, 0);

    const stats = calculatePaymentStats(payments);
    const monthlyPayments = calculateMonthlyPayments(payments);
    const balanceHistory = calculateBalanceHistory(payments, currentTotalBalance);
    const payoffPercentage = calculatePayoffPercentage(totalBalanceDelta, currentTotalBalance);

    // Interest saved: projected interest on today's balances vs. what the
    // projection would be had none of the logged payments been applied.
    let interestSavedCents = 0;
    if (debts.length > 0 && totalBalanceDelta > 0) {
      const currentInputs: DebtInput[] = debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance_cents: d.balance_cents,
        apr_bps: d.apr_bps,
        min_payment_cents: d.min_payment_cents,
      }));

      const deltaByDebt = new Map<string, number>();
      const { data: paymentsByDebt } = await supabase
        .from('payments')
        .select('debt_id, balance_delta_cents')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id);
      for (const payment of paymentsByDebt ?? []) {
        deltaByDebt.set(
          payment.debt_id,
          (deltaByDebt.get(payment.debt_id) ?? 0) + payment.balance_delta_cents
        );
      }

      const withoutPayments: DebtInput[] = currentInputs.map((d) => ({
        ...d,
        balance_cents: d.balance_cents + (deltaByDebt.get(d.id) ?? 0),
      }));

      const projectedNow = calculatePayoff(currentInputs, 'avalanche');
      const projectedWithout = calculatePayoff(withoutPayments, 'avalanche');
      interestSavedCents = Math.max(
        0,
        projectedWithout.total_interest_cents - projectedNow.total_interest_cents
      );
    }

    return NextResponse.json({
      ...stats,
      interest_saved_cents: interestSavedCents,
      payoff_percentage: payoffPercentage,
      current_total_balance_cents: currentTotalBalance,
      monthly_payments: monthlyPayments,
      balance_history: balanceHistory,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
