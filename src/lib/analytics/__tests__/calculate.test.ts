import {
  calculatePaymentStats,
  calculateMonthlyPayments,
  calculateBalanceHistory,
  calculatePayoffPercentage,
} from '../calculate';

// Fixed "now" so streak/window math is deterministic: July 4, 2026
const NOW = new Date(2026, 6, 4);

function payment(paidAt: string, amountCents: number, deltaCents = amountCents) {
  return {
    amount_cents: amountCents,
    balance_delta_cents: deltaCents,
    paid_at: paidAt,
  };
}

describe('calculatePaymentStats', () => {
  it('returns zeroed stats when there are no payments', () => {
    const stats = calculatePaymentStats([], NOW);

    expect(stats.total_paid_cents).toBe(0);
    expect(stats.payment_count).toBe(0);
    expect(stats.average_payment_cents).toBe(0);
    expect(stats.average_monthly_payment_cents).toBe(0);
    expect(stats.largest_payment_cents).toBe(0);
    expect(stats.last_payment_date).toBeNull();
    expect(stats.longest_streak_months).toBe(0);
    expect(stats.current_streak_months).toBe(0);
  });

  it('computes totals, averages, largest and last payment', () => {
    const stats = calculatePaymentStats(
      [
        payment('2026-05-10', 10000),
        payment('2026-06-05', 30000),
        payment('2026-07-01', 20000),
      ],
      NOW
    );

    expect(stats.total_paid_cents).toBe(60000);
    expect(stats.payment_count).toBe(3);
    expect(stats.average_payment_cents).toBe(20000);
    expect(stats.largest_payment_cents).toBe(30000);
    expect(stats.last_payment_date).toBe('2026-07-01');
    // 3 months from May through July → 60000 / 3
    expect(stats.average_monthly_payment_cents).toBe(20000);
  });

  it('averages monthly over the full span even with gap months', () => {
    const stats = calculatePaymentStats(
      [payment('2026-01-15', 40000), payment('2026-07-01', 20000)],
      NOW
    );

    // Jan through Jul = 7 months
    expect(stats.average_monthly_payment_cents).toBe(Math.round(60000 / 7));
  });

  it('finds the longest consecutive-month streak', () => {
    const stats = calculatePaymentStats(
      [
        // 3-month streak: Jan-Mar
        payment('2026-01-05', 1000),
        payment('2026-02-05', 1000),
        payment('2026-03-05', 1000),
        // gap in Apr/May
        payment('2026-06-05', 1000),
        payment('2026-07-01', 1000),
      ],
      NOW
    );

    expect(stats.longest_streak_months).toBe(3);
    // Jun + Jul, ending in the current month
    expect(stats.current_streak_months).toBe(2);
  });

  it('keeps the current streak alive if this month has no payment yet', () => {
    const stats = calculatePaymentStats(
      [payment('2026-05-20', 1000), payment('2026-06-20', 1000)],
      NOW // July 4th, no July payment yet
    );

    expect(stats.current_streak_months).toBe(2);
  });

  it('reports a broken current streak as zero', () => {
    const stats = calculatePaymentStats([payment('2026-03-20', 1000)], NOW);

    expect(stats.longest_streak_months).toBe(1);
    expect(stats.current_streak_months).toBe(0);
  });

  it('counts multiple payments in one month as a single streak month', () => {
    const stats = calculatePaymentStats(
      [payment('2026-07-01', 1000), payment('2026-07-02', 1000)],
      NOW
    );

    expect(stats.longest_streak_months).toBe(1);
    expect(stats.current_streak_months).toBe(1);
  });
});

describe('calculateMonthlyPayments', () => {
  it('buckets payments by calendar month including empty months', () => {
    const points = calculateMonthlyPayments(
      [
        payment('2026-05-01', 10000),
        payment('2026-05-20', 5000),
        payment('2026-07-01', 20000),
      ],
      4,
      NOW
    );

    expect(points).toHaveLength(4);
    expect(points.map((p) => p.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07']);
    expect(points[0]).toMatchObject({ total_cents: 0, payment_count: 0 });
    expect(points[1]).toMatchObject({ total_cents: 15000, payment_count: 2 });
    expect(points[2]).toMatchObject({ total_cents: 0, payment_count: 0 });
    expect(points[3]).toMatchObject({ total_cents: 20000, payment_count: 1 });
  });

  it('ignores payments outside the window', () => {
    const points = calculateMonthlyPayments([payment('2020-01-01', 99999)], 3, NOW);

    expect(points.every((p) => p.total_cents === 0)).toBe(true);
  });

  it('spans a year boundary correctly', () => {
    const january = new Date(2026, 0, 15);
    const points = calculateMonthlyPayments(
      [payment('2025-12-05', 1000), payment('2026-01-05', 2000)],
      3,
      january
    );

    expect(points.map((p) => p.month)).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(points[1].total_cents).toBe(1000);
    expect(points[2].total_cents).toBe(2000);
  });
});

describe('calculateBalanceHistory', () => {
  it('returns an empty series with no payments', () => {
    expect(calculateBalanceHistory([], 100000, NOW)).toEqual([]);
  });

  it('walks the balance backwards using applied deltas', () => {
    // Current balance 50000 after paying 20000 in May and 30000 in June
    const points = calculateBalanceHistory(
      [payment('2026-05-10', 20000), payment('2026-06-10', 30000)],
      50000,
      NOW
    );

    const byMonth = Object.fromEntries(points.map((p) => [p.month, p.balance_cents]));
    // Before any payments (end of April): everything still owed
    expect(byMonth['2026-04']).toBe(100000);
    expect(byMonth['2026-05']).toBe(80000);
    expect(byMonth['2026-06']).toBe(50000);
    expect(byMonth['2026-07']).toBe(50000);
  });

  it('uses balance deltas rather than raw amounts for overpayments', () => {
    // Paid 150000 but only 100000 applied to the balance
    const points = calculateBalanceHistory(
      [payment('2026-06-10', 150000, 100000)],
      0,
      NOW
    );

    const byMonth = Object.fromEntries(points.map((p) => [p.month, p.balance_cents]));
    expect(byMonth['2026-05']).toBe(100000);
    expect(byMonth['2026-06']).toBe(0);
  });
});

describe('calculatePayoffPercentage', () => {
  it('is zero with nothing paid and nothing owed', () => {
    expect(calculatePayoffPercentage(0, 0)).toBe(0);
  });

  it('computes paid share of the original total', () => {
    expect(calculatePayoffPercentage(25000, 75000)).toBe(25);
    expect(calculatePayoffPercentage(100000, 0)).toBe(100);
  });

  it('never exceeds 100', () => {
    expect(calculatePayoffPercentage(200000, 0)).toBe(100);
  });
});
