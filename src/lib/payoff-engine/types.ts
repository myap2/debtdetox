export interface DebtInput {
  id: string;
  name: string;
  balance_cents: number;
  apr_bps: number; // basis points (500 = 5.00%)
  min_payment_cents: number;
}

export interface MonthlyPayment {
  debt_id: string;
  debt_name: string;
  payment_cents: number;
  principal_cents: number;
  interest_cents: number;
  remaining_balance_cents: number;
}

export interface MonthlyBreakdown {
  month: number;
  date: Date;
  payments: MonthlyPayment[];
  total_payment_cents: number;
  total_remaining_cents: number;
}

export interface PayoffResult {
  schedule: MonthlyBreakdown[];
  total_interest_cents: number;
  total_paid_cents: number;
  debt_free_date: Date;
  months_to_payoff: number;
  debts_payoff_order: { id: string; name: string; payoff_month: number }[];
}

export type PayoffStrategy = 'snowball' | 'avalanche';
