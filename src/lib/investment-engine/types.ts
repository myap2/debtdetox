// Investment Types
export type InvestmentType =
  | 'stocks'
  | 'bonds'
  | 'retirement_401k'
  | 'retirement_ira'
  | 'real_estate'
  | 'savings'
  | 'crypto'
  | 'custom';

export type TaxStatus = 'taxable' | 'tax_deferred' | 'tax_free';

export type CompoundFrequency = 'monthly' | 'quarterly' | 'annually';

// Input for calculations (pure functions)
export interface InvestmentInput {
  id: string;
  name: string;
  initial_balance_cents: number;
  monthly_contribution_cents: number;
  annual_return_bps: number; // basis points (700 = 7.00%)
  tax_status: TaxStatus;
  tax_rate_bps: number; // basis points (2500 = 25%)
  inflation_rate_bps: number; // basis points (300 = 3%)
}

export interface InvestmentCalculationOptions {
  years: number;
  include_inflation: boolean;
  include_taxes: boolean;
  compound_frequency: CompoundFrequency;
}

// Monthly breakdown in projection schedule
export interface MonthlyInvestmentBreakdown {
  month: number;
  date: Date;
  contribution_cents: number;
  interest_earned_cents: number;
  balance_cents: number;
  real_balance_cents: number; // inflation-adjusted
  cumulative_contributions_cents: number;
  cumulative_interest_cents: number;
}

// Full projection result
export interface InvestmentProjection {
  schedule: MonthlyInvestmentBreakdown[];
  final_balance_cents: number;
  final_real_balance_cents: number;
  total_contributions_cents: number;
  total_interest_cents: number;
  effective_annual_return_bps: number;
  tax_impact_cents: number;
  after_tax_balance_cents: number;
  months_to_target: number | null;
  target_achievable: boolean;
}

// Retirement projection
export interface RetirementProjection {
  projection: InvestmentProjection;
  monthly_income_cents: number; // 4% rule withdrawal
  years_of_runway: number;
  recommended_contribution_cents: number;
  shortfall_cents: number | null;
  target_cents: number;
}

// Debt vs Invest comparison
export interface DebtVsInvestScenario {
  extra_payment_cents: number;
  // If used for debt
  debt_interest_saved_cents: number;
  months_saved_on_debt: number;
  debt_free_date: Date;
  // If invested instead
  investment_growth_cents: number;
  investment_final_balance_cents: number;
  // Comparison
  net_benefit_cents: number;
  recommended: 'pay_debt' | 'invest';
  reasoning: string;
}

export interface DebtVsInvestResult {
  scenarios: DebtVsInvestScenario[];
  breakeven_return_bps: number; // investment return where strategies equal
  summary: {
    weighted_debt_apr_bps: number;
    expected_investment_return_bps: number;
    recommendation: 'pay_debt' | 'invest' | 'split';
    reasoning: string;
  };
}

// Default values for common investment types
export const INVESTMENT_DEFAULTS: Record<
  InvestmentType,
  { annual_return_bps: number; tax_status: TaxStatus }
> = {
  stocks: { annual_return_bps: 1000, tax_status: 'taxable' }, // 10%
  bonds: { annual_return_bps: 500, tax_status: 'taxable' }, // 5%
  retirement_401k: { annual_return_bps: 700, tax_status: 'tax_deferred' }, // 7%
  retirement_ira: { annual_return_bps: 700, tax_status: 'tax_deferred' }, // 7%
  real_estate: { annual_return_bps: 800, tax_status: 'taxable' }, // 8%
  savings: { annual_return_bps: 450, tax_status: 'taxable' }, // 4.5%
  crypto: { annual_return_bps: 1500, tax_status: 'taxable' }, // 15% (high risk)
  custom: { annual_return_bps: 700, tax_status: 'taxable' }, // 7%
};
