import type {
  InvestmentInput,
  InvestmentCalculationOptions,
  MonthlyInvestmentBreakdown,
  InvestmentProjection,
  RetirementProjection,
  DebtVsInvestScenario,
  DebtVsInvestResult,
  TaxStatus,
} from './types';
import type { DebtInput } from '../payoff-engine/types';
import { calculatePayoff } from '../payoff-engine/calculate';

// Convert annual basis points to monthly rate using compound interest formula
function getMonthlyReturnRate(annual_bps: number): number {
  const annualRate = annual_bps / 10000;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

// Convert annual inflation bps to monthly rate
function getMonthlyInflationRate(annual_bps: number): number {
  const annualRate = annual_bps / 10000;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

// Calculate CAGR from start/end values over months
function calculateCAGR(
  start_cents: number,
  end_cents: number,
  months: number
): number {
  if (start_cents <= 0 || months <= 0) return 0;
  const years = months / 12;
  const cagr = Math.pow(end_cents / start_cents, 1 / years) - 1;
  return Math.round(cagr * 10000); // Return as basis points
}

export function calculateInvestmentGrowth(
  investment: InvestmentInput,
  options: InvestmentCalculationOptions
): InvestmentProjection {
  const totalMonths = options.years * 12;

  if (totalMonths <= 0) {
    return {
      schedule: [],
      final_balance_cents: investment.initial_balance_cents,
      final_real_balance_cents: investment.initial_balance_cents,
      total_contributions_cents: investment.initial_balance_cents,
      total_interest_cents: 0,
      effective_annual_return_bps: 0,
      tax_impact_cents: 0,
      after_tax_balance_cents: investment.initial_balance_cents,
      months_to_target: null,
      target_achievable: false,
    };
  }

  const monthlyReturnRate = getMonthlyReturnRate(investment.annual_return_bps);
  const monthlyInflationRate = options.include_inflation
    ? getMonthlyInflationRate(investment.inflation_rate_bps)
    : 0;

  const schedule: MonthlyInvestmentBreakdown[] = [];
  const startDate = new Date();

  let balance_cents = investment.initial_balance_cents;
  let cumulative_contributions_cents = investment.initial_balance_cents;
  let cumulative_interest_cents = 0;
  let cumulative_inflation_factor = 1;

  for (let month = 1; month <= totalMonths; month++) {
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + month);

    // Add monthly contribution
    const contribution_cents = investment.monthly_contribution_cents;
    balance_cents += contribution_cents;
    cumulative_contributions_cents += contribution_cents;

    // Calculate interest earned this month
    const interest_earned_cents = Math.round(balance_cents * monthlyReturnRate);
    balance_cents += interest_earned_cents;
    cumulative_interest_cents += interest_earned_cents;

    // Track inflation for real balance calculation
    cumulative_inflation_factor *= 1 + monthlyInflationRate;
    const real_balance_cents = Math.round(
      balance_cents / cumulative_inflation_factor
    );

    schedule.push({
      month,
      date: monthDate,
      contribution_cents,
      interest_earned_cents,
      balance_cents,
      real_balance_cents,
      cumulative_contributions_cents,
      cumulative_interest_cents,
    });
  }

  const finalBalance = schedule[schedule.length - 1];

  // Calculate tax impact
  const { tax_impact_cents, after_tax_balance_cents } = calculateTaxImpact(
    cumulative_interest_cents,
    investment.tax_status,
    investment.tax_rate_bps,
    finalBalance.balance_cents
  );

  // Calculate effective return (CAGR)
  const totalContributed =
    investment.initial_balance_cents +
    investment.monthly_contribution_cents * totalMonths;
  const effective_annual_return_bps = calculateCAGR(
    totalContributed > 0 ? totalContributed : 1,
    finalBalance.balance_cents,
    totalMonths
  );

  return {
    schedule,
    final_balance_cents: finalBalance.balance_cents,
    final_real_balance_cents: finalBalance.real_balance_cents,
    total_contributions_cents: cumulative_contributions_cents,
    total_interest_cents: cumulative_interest_cents,
    effective_annual_return_bps,
    tax_impact_cents: options.include_taxes ? tax_impact_cents : 0,
    after_tax_balance_cents: options.include_taxes
      ? after_tax_balance_cents
      : finalBalance.balance_cents,
    months_to_target: null,
    target_achievable: false,
  };
}

export function calculateTaxImpact(
  gains_cents: number,
  tax_status: TaxStatus,
  tax_rate_bps: number,
  total_balance_cents: number
): { tax_impact_cents: number; after_tax_balance_cents: number } {
  const taxRate = tax_rate_bps / 10000;

  switch (tax_status) {
    case 'tax_free':
      // Roth IRA - no taxes on gains
      return {
        tax_impact_cents: 0,
        after_tax_balance_cents: total_balance_cents,
      };

    case 'tax_deferred':
      // Traditional 401k/IRA - taxes on full withdrawal
      const deferredTax = Math.round(total_balance_cents * taxRate);
      return {
        tax_impact_cents: deferredTax,
        after_tax_balance_cents: total_balance_cents - deferredTax,
      };

    case 'taxable':
    default:
      // Regular brokerage - taxes on gains only
      const gainsTax = Math.round(gains_cents * taxRate);
      return {
        tax_impact_cents: gainsTax,
        after_tax_balance_cents: total_balance_cents - gainsTax,
      };
  }
}

export function calculateRetirementProjection(
  investment: InvestmentInput,
  target_cents: number,
  max_years: number = 50
): RetirementProjection {
  const options: InvestmentCalculationOptions = {
    years: max_years,
    include_inflation: true,
    include_taxes: true,
    compound_frequency: 'monthly',
  };

  const projection = calculateInvestmentGrowth(investment, options);

  // Find month when target is reached
  let months_to_target: number | null = null;
  for (const month of projection.schedule) {
    if (month.balance_cents >= target_cents) {
      months_to_target = month.month;
      break;
    }
  }

  const target_achievable = months_to_target !== null;

  // Calculate 4% rule monthly income (annual withdrawal / 12)
  const finalBalance = projection.after_tax_balance_cents;
  const annual_withdrawal = Math.round(finalBalance * 0.04);
  const monthly_income_cents = Math.round(annual_withdrawal / 12);

  // Estimate years of runway (using 4% rule, theoretically infinite but cap at 30)
  const years_of_runway = 30;

  // Calculate shortfall if target not met
  const shortfall_cents = target_achievable
    ? null
    : target_cents - projection.final_balance_cents;

  // Calculate recommended contribution to hit target in max_years
  let recommended_contribution_cents = investment.monthly_contribution_cents;
  if (!target_achievable && max_years > 0) {
    // Binary search for required monthly contribution
    let low = investment.monthly_contribution_cents;
    let high = target_cents / 12; // Max reasonable contribution

    for (let i = 0; i < 20; i++) {
      const mid = Math.round((low + high) / 2);
      const testInvestment = { ...investment, monthly_contribution_cents: mid };
      const testProjection = calculateInvestmentGrowth(testInvestment, options);

      if (testProjection.final_balance_cents >= target_cents) {
        recommended_contribution_cents = mid;
        high = mid;
      } else {
        low = mid;
      }
    }
  }

  return {
    projection: {
      ...projection,
      months_to_target,
      target_achievable,
    },
    monthly_income_cents,
    years_of_runway,
    recommended_contribution_cents,
    shortfall_cents,
    target_cents,
  };
}

export function compareDebtVsInvest(
  debts: DebtInput[],
  investment: InvestmentInput,
  extra_amounts_cents: number[],
  years: number
): DebtVsInvestResult {
  // Calculate weighted average debt APR
  const totalDebt = debts.reduce((sum, d) => sum + d.balance_cents, 0);
  const weightedApr =
    totalDebt > 0
      ? debts.reduce(
          (sum, d) => sum + (d.balance_cents / totalDebt) * d.apr_bps,
          0
        )
      : 0;

  const scenarios: DebtVsInvestScenario[] = [];

  for (const extra_payment_cents of extra_amounts_cents) {
    // Scenario 1: Pay extra towards debt
    const withExtra = calculatePayoff(debts, 'avalanche', extra_payment_cents);
    const withoutExtra = calculatePayoff(debts, 'avalanche', 0);

    const debt_interest_saved_cents =
      withoutExtra.total_interest_cents - withExtra.total_interest_cents;
    const months_saved_on_debt =
      withoutExtra.months_to_payoff - withExtra.months_to_payoff;

    // Scenario 2: Invest the extra instead
    const investmentWithExtra: InvestmentInput = {
      ...investment,
      initial_balance_cents: 0, // Start from 0 for comparison
      monthly_contribution_cents: extra_payment_cents,
    };

    const investProjection = calculateInvestmentGrowth(investmentWithExtra, {
      years,
      include_inflation: false, // Compare nominal values
      include_taxes: false, // Simplify comparison
      compound_frequency: 'monthly',
    });

    const investment_growth_cents = investProjection.total_interest_cents;
    const investment_final_balance_cents =
      investProjection.final_balance_cents;

    // Compare outcomes
    // Net benefit = investment gains - debt interest saved
    // If positive, investing is better; if negative, paying debt is better
    const net_benefit_cents =
      investment_growth_cents - debt_interest_saved_cents;

    // Recommendation based on returns vs debt cost
    const recommended: 'pay_debt' | 'invest' =
      investment.annual_return_bps > weightedApr ? 'invest' : 'pay_debt';

    const reasoning =
      recommended === 'invest'
        ? `Expected ${(investment.annual_return_bps / 100).toFixed(1)}% investment return exceeds ${(weightedApr / 100).toFixed(1)}% average debt APR`
        : `${(weightedApr / 100).toFixed(1)}% debt APR exceeds ${(investment.annual_return_bps / 100).toFixed(1)}% expected investment return`;

    scenarios.push({
      extra_payment_cents,
      debt_interest_saved_cents,
      months_saved_on_debt,
      debt_free_date: withExtra.debt_free_date,
      investment_growth_cents,
      investment_final_balance_cents,
      net_benefit_cents,
      recommended,
      reasoning,
    });
  }

  // Find breakeven return (where investing = paying debt)
  // At breakeven: investment return = weighted debt APR
  const breakeven_return_bps = Math.round(weightedApr);

  // Overall recommendation
  const recommendation: 'pay_debt' | 'invest' | 'split' =
    investment.annual_return_bps > weightedApr + 200
      ? 'invest' // Clear advantage to investing (>2% better)
      : investment.annual_return_bps < weightedApr - 200
        ? 'pay_debt' // Clear advantage to debt payoff
        : 'split'; // Close enough to split

  const summaryReasoning =
    recommendation === 'invest'
      ? `Your expected ${(investment.annual_return_bps / 100).toFixed(1)}% investment return significantly exceeds your ${(weightedApr / 100).toFixed(1)}% average debt cost. Prioritize investing.`
      : recommendation === 'pay_debt'
        ? `Your ${(weightedApr / 100).toFixed(1)}% average debt cost exceeds your ${(investment.annual_return_bps / 100).toFixed(1)}% expected investment return. Prioritize debt payoff.`
        : `Your debt cost (${(weightedApr / 100).toFixed(1)}%) and expected returns (${(investment.annual_return_bps / 100).toFixed(1)}%) are close. Consider splitting extra payments between both.`;

  return {
    scenarios,
    breakeven_return_bps,
    summary: {
      weighted_debt_apr_bps: Math.round(weightedApr),
      expected_investment_return_bps: investment.annual_return_bps,
      recommendation,
      reasoning: summaryReasoning,
    },
  };
}

export function compareInvestmentStrategies(
  investments: InvestmentInput[],
  years: number
): {
  projections: { investment: InvestmentInput; projection: InvestmentProjection }[];
  best_return_id: string;
  total_value_cents: number;
} {
  const options: InvestmentCalculationOptions = {
    years,
    include_inflation: true,
    include_taxes: true,
    compound_frequency: 'monthly',
  };

  const projections = investments.map((investment) => ({
    investment,
    projection: calculateInvestmentGrowth(investment, options),
  }));

  const best = projections.reduce((a, b) =>
    a.projection.after_tax_balance_cents > b.projection.after_tax_balance_cents
      ? a
      : b
  );

  const total_value_cents = projections.reduce(
    (sum, p) => sum + p.projection.after_tax_balance_cents,
    0
  );

  return {
    projections,
    best_return_id: best.investment.id,
    total_value_cents,
  };
}
