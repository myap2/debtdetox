import type { Payment } from '@/types/database';

export interface PaymentStats {
  total_paid_cents: number;
  payment_count: number;
  average_payment_cents: number;
  average_monthly_payment_cents: number;
  largest_payment_cents: number;
  last_payment_date: string | null;
  longest_streak_months: number;
  current_streak_months: number;
}

export interface MonthlyPaymentPoint {
  month: string; // YYYY-MM
  total_cents: number;
  payment_count: number;
}

export interface BalancePoint {
  month: string; // YYYY-MM
  balance_cents: number;
}

type PaymentLike = Pick<Payment, 'amount_cents' | 'balance_delta_cents' | 'paid_at'>;

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthIndex(key: string): number {
  const [year, month] = key.split('-').map(Number);
  return year * 12 + (month - 1);
}

function monthKeyFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function calculatePaymentStats(payments: PaymentLike[], now: Date = new Date()): PaymentStats {
  if (payments.length === 0) {
    return {
      total_paid_cents: 0,
      payment_count: 0,
      average_payment_cents: 0,
      average_monthly_payment_cents: 0,
      largest_payment_cents: 0,
      last_payment_date: null,
      longest_streak_months: 0,
      current_streak_months: 0,
    };
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const largest = payments.reduce((max, p) => Math.max(max, p.amount_cents), 0);
  const sortedDates = payments.map((p) => p.paid_at).sort();
  const lastPaymentDate = sortedDates[sortedDates.length - 1];

  // Average monthly payment: total paid over the span of months with activity,
  // from the first payment month through the current month.
  const firstMonth = monthIndex(monthKey(sortedDates[0]));
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const monthSpan = Math.max(1, currentMonth - firstMonth + 1);

  const activeMonths = new Set(payments.map((p) => monthIndex(monthKey(p.paid_at))));

  // Longest run of consecutive calendar months containing at least one payment
  let longestStreak = 0;
  let currentRun = 0;
  let previous: number | null = null;
  for (const month of [...activeMonths].sort((a, b) => a - b)) {
    currentRun = previous !== null && month === previous + 1 ? currentRun + 1 : 1;
    longestStreak = Math.max(longestStreak, currentRun);
    previous = month;
  }

  // Current streak: consecutive months with payments ending in this month
  // (or last month, so an early-in-the-month check doesn't break the streak).
  let currentStreak = 0;
  let cursor = activeMonths.has(currentMonth) ? currentMonth : currentMonth - 1;
  while (activeMonths.has(cursor)) {
    currentStreak++;
    cursor--;
  }

  return {
    total_paid_cents: totalPaid,
    payment_count: payments.length,
    average_payment_cents: Math.round(totalPaid / payments.length),
    average_monthly_payment_cents: Math.round(totalPaid / monthSpan),
    largest_payment_cents: largest,
    last_payment_date: lastPaymentDate,
    longest_streak_months: longestStreak,
    current_streak_months: currentStreak,
  };
}

/**
 * Total payments per calendar month for the trailing `months` window,
 * including empty months so charts show gaps honestly.
 */
export function calculateMonthlyPayments(
  payments: PaymentLike[],
  months: number = 12,
  now: Date = new Date()
): MonthlyPaymentPoint[] {
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const startMonth = currentMonth - (months - 1);

  const totals = new Map<number, { total: number; count: number }>();
  for (const payment of payments) {
    const index = monthIndex(monthKey(payment.paid_at));
    if (index < startMonth || index > currentMonth) continue;
    const entry = totals.get(index) ?? { total: 0, count: 0 };
    entry.total += payment.amount_cents;
    entry.count += 1;
    totals.set(index, entry);
  }

  const points: MonthlyPaymentPoint[] = [];
  for (let index = startMonth; index <= currentMonth; index++) {
    const entry = totals.get(index);
    points.push({
      month: monthKeyFromIndex(index),
      total_cents: entry?.total ?? 0,
      payment_count: entry?.count ?? 0,
    });
  }
  return points;
}

/**
 * Reconstructs total debt balance at each month-end by walking payments
 * backwards from the current balance. Uses balance_delta_cents (the amount
 * each payment actually reduced balances by) so overpayments don't distort
 * the series.
 */
export function calculateBalanceHistory(
  payments: PaymentLike[],
  currentTotalBalanceCents: number,
  now: Date = new Date()
): BalancePoint[] {
  if (payments.length === 0) {
    return [];
  }

  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const firstMonth = monthIndex(monthKey(payments.map((p) => p.paid_at).sort()[0]));

  const deltaByMonth = new Map<number, number>();
  for (const payment of payments) {
    const index = monthIndex(monthKey(payment.paid_at));
    deltaByMonth.set(index, (deltaByMonth.get(index) ?? 0) + payment.balance_delta_cents);
  }

  // Walk backwards: the balance at the end of month M equals the balance at
  // the end of month M+1 plus everything paid during month M+1.
  const points: BalancePoint[] = [];
  let balance = currentTotalBalanceCents;
  for (let index = currentMonth; index >= firstMonth - 1; index--) {
    points.unshift({ month: monthKeyFromIndex(index), balance_cents: balance });
    balance += deltaByMonth.get(index) ?? 0;
  }
  return points;
}

/**
 * Share of the journey completed: what's been paid off versus the total
 * (paid off + still owed).
 */
export function calculatePayoffPercentage(
  totalBalanceDeltaCents: number,
  currentTotalBalanceCents: number
): number {
  const original = totalBalanceDeltaCents + currentTotalBalanceCents;
  if (original <= 0) return 0;
  return Math.min(100, (totalBalanceDeltaCents / original) * 100);
}
