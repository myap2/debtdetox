import { calculatePayoff, compareStrategies } from '@/lib/payoff-engine';
import type { DebtInput, PayoffResult } from '@/lib/payoff-engine';
import type { Debt, PlanSnapshotData, SerializedMonthlyBreakdown } from '@/types/database';

export type SnapshotDebt = Pick<
  Debt,
  'id' | 'name' | 'type' | 'balance_cents' | 'apr_bps' | 'min_payment_cents'
>;

function serializeResult(result: PayoffResult): PlanSnapshotData['result'] {
  const schedule: SerializedMonthlyBreakdown[] = result.schedule.map((month) => ({
    month: month.month,
    date: new Date(month.date).toISOString(),
    payments: month.payments,
    total_payment_cents: month.total_payment_cents,
    total_remaining_cents: month.total_remaining_cents,
  }));

  return {
    schedule,
    total_interest_cents: result.total_interest_cents,
    total_paid_cents: result.total_paid_cents,
    debt_free_date: new Date(result.debt_free_date).toISOString(),
    months_to_payoff: result.months_to_payoff,
    debts_payoff_order: result.debts_payoff_order,
  };
}

/**
 * Computes the full snapshot stored alongside a saved plan: the chosen
 * strategy's schedule plus comparison data and the debts as they were at
 * save time, so the plan can be reopened later without recalculating.
 */
export function buildPlanSnapshot(
  debts: SnapshotDebt[],
  strategy: 'snowball' | 'avalanche',
  extraPaymentCents: number
): PlanSnapshotData {
  const debtInputs: DebtInput[] = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance_cents: d.balance_cents,
    apr_bps: d.apr_bps,
    min_payment_cents: d.min_payment_cents,
  }));

  const comparison = compareStrategies(debtInputs, extraPaymentCents);
  const result = calculatePayoff(debtInputs, strategy, extraPaymentCents);

  return {
    strategy,
    extra_payment_cents: extraPaymentCents,
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      balance_cents: d.balance_cents,
      apr_bps: d.apr_bps,
      min_payment_cents: d.min_payment_cents,
    })),
    result: serializeResult(result),
    comparison: {
      snowball_interest_cents: comparison.snowball.total_interest_cents,
      avalanche_interest_cents: comparison.avalanche.total_interest_cents,
      snowball_months: comparison.snowball.months_to_payoff,
      avalanche_months: comparison.avalanche.months_to_payoff,
      savings_cents: comparison.savings_cents,
      faster_strategy: comparison.faster_strategy,
      months_saved: comparison.months_saved,
    },
  };
}
