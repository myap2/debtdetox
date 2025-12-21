import type {
  DebtInput,
  MonthlyBreakdown,
  MonthlyPayment,
  PayoffResult,
  PayoffStrategy,
} from './types';

interface DebtState {
  id: string;
  name: string;
  balance_cents: number;
  apr_bps: number;
  min_payment_cents: number;
  is_paid_off: boolean;
  payoff_month?: number;
}

function getMonthlyInterestRate(apr_bps: number): number {
  // Convert basis points to decimal (500 bps = 0.05)
  // Then divide by 12 for monthly rate
  return apr_bps / 10000 / 12;
}

function sortDebts(debts: DebtState[], strategy: PayoffStrategy): DebtState[] {
  return [...debts].sort((a, b) => {
    if (a.is_paid_off !== b.is_paid_off) {
      return a.is_paid_off ? 1 : -1; // Paid off debts go to end
    }
    if (strategy === 'snowball') {
      // Smallest balance first
      return a.balance_cents - b.balance_cents;
    } else {
      // Highest APR first (avalanche)
      return b.apr_bps - a.apr_bps;
    }
  });
}

export function calculatePayoff(
  debts: DebtInput[],
  strategy: PayoffStrategy,
  extra_payment_cents: number = 0
): PayoffResult {
  if (debts.length === 0) {
    return {
      schedule: [],
      total_interest_cents: 0,
      total_paid_cents: 0,
      debt_free_date: new Date(),
      months_to_payoff: 0,
      debts_payoff_order: [],
    };
  }

  // Initialize debt states
  let debtStates: DebtState[] = debts.map((d) => ({
    ...d,
    is_paid_off: d.balance_cents <= 0,
  }));

  const schedule: MonthlyBreakdown[] = [];
  const debtsPayoffOrder: { id: string; name: string; payoff_month: number }[] = [];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const startDate = new Date();
  const maxMonths = 360; // 30 years max to prevent infinite loops

  while (debtStates.some((d) => !d.is_paid_off) && month < maxMonths) {
    month++;

    // Calculate date for this month
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + month);

    // Sort debts by strategy
    debtStates = sortDebts(debtStates, strategy);

    const payments: MonthlyPayment[] = [];
    let availableExtra = extra_payment_cents;

    // First pass: apply interest and calculate minimum payments
    for (const debt of debtStates) {
      if (debt.is_paid_off) continue;

      // Calculate interest for this month
      const monthlyRate = getMonthlyInterestRate(debt.apr_bps);
      const interest = Math.round(debt.balance_cents * monthlyRate);
      totalInterest += interest;

      // Add interest to balance
      debt.balance_cents += interest;

      // Calculate minimum payment (can't exceed balance)
      const minPayment = Math.min(debt.min_payment_cents, debt.balance_cents);

      // Apply minimum payment
      debt.balance_cents -= minPayment;
      totalPaid += minPayment;

      const principalPaid = minPayment - interest;

      payments.push({
        debt_id: debt.id,
        debt_name: debt.name,
        payment_cents: minPayment,
        principal_cents: Math.max(0, principalPaid),
        interest_cents: Math.min(interest, minPayment),
        remaining_balance_cents: debt.balance_cents,
      });

      // Check if paid off
      if (debt.balance_cents <= 0) {
        debt.is_paid_off = true;
        debt.balance_cents = 0;
        debt.payoff_month = month;
        debtsPayoffOrder.push({
          id: debt.id,
          name: debt.name,
          payoff_month: month,
        });
        // Add freed up minimum payment to extra
        availableExtra += debt.min_payment_cents;
      }
    }

    // Second pass: apply extra payments to target debt (first non-paid-off)
    for (const debt of debtStates) {
      if (debt.is_paid_off || availableExtra <= 0) continue;

      const extraToApply = Math.min(availableExtra, debt.balance_cents);
      if (extraToApply > 0) {
        debt.balance_cents -= extraToApply;
        availableExtra -= extraToApply;
        totalPaid += extraToApply;

        // Update the payment record
        const paymentRecord = payments.find((p) => p.debt_id === debt.id);
        if (paymentRecord) {
          paymentRecord.payment_cents += extraToApply;
          paymentRecord.principal_cents += extraToApply;
          paymentRecord.remaining_balance_cents = debt.balance_cents;
        }

        // Check if now paid off
        if (debt.balance_cents <= 0) {
          debt.is_paid_off = true;
          debt.balance_cents = 0;
          debt.payoff_month = month;
          debtsPayoffOrder.push({
            id: debt.id,
            name: debt.name,
            payoff_month: month,
          });
          // Add freed up minimum payment to extra for next iteration
          availableExtra += debt.min_payment_cents;
        }
      }
    }

    // Calculate totals for this month
    const totalPayment = payments.reduce((sum, p) => sum + p.payment_cents, 0);
    const totalRemaining = debtStates.reduce((sum, d) => sum + d.balance_cents, 0);

    schedule.push({
      month,
      date: monthDate,
      payments,
      total_payment_cents: totalPayment,
      total_remaining_cents: totalRemaining,
    });
  }

  // Calculate debt-free date
  const debtFreeDate = new Date(startDate);
  debtFreeDate.setMonth(debtFreeDate.getMonth() + month);

  return {
    schedule,
    total_interest_cents: totalInterest,
    total_paid_cents: totalPaid,
    debt_free_date: debtFreeDate,
    months_to_payoff: month,
    debts_payoff_order: debtsPayoffOrder,
  };
}

export function compareStrategies(
  debts: DebtInput[],
  extra_payment_cents: number = 0
): {
  snowball: PayoffResult;
  avalanche: PayoffResult;
  savings_cents: number;
  faster_strategy: PayoffStrategy;
  months_saved: number;
} {
  const snowball = calculatePayoff(debts, 'snowball', extra_payment_cents);
  const avalanche = calculatePayoff(debts, 'avalanche', extra_payment_cents);

  const savings = snowball.total_interest_cents - avalanche.total_interest_cents;
  const monthsDiff = snowball.months_to_payoff - avalanche.months_to_payoff;

  return {
    snowball,
    avalanche,
    savings_cents: Math.abs(savings),
    faster_strategy: monthsDiff > 0 ? 'avalanche' : monthsDiff < 0 ? 'snowball' : 'avalanche',
    months_saved: Math.abs(monthsDiff),
  };
}
