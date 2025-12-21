import {
  calculateInvestmentGrowth,
  calculateTaxImpact,
  calculateRetirementProjection,
  compareDebtVsInvest,
  compareInvestmentStrategies,
} from '../calculate';
import type { InvestmentInput, InvestmentCalculationOptions } from '../types';
import type { DebtInput } from '../../payoff-engine/types';

const defaultOptions: InvestmentCalculationOptions = {
  years: 10,
  include_inflation: true,
  include_taxes: true,
  compound_frequency: 'monthly',
};

describe('calculateInvestmentGrowth', () => {
  describe('basic compound interest', () => {
    const basicInvestment: InvestmentInput = {
      id: 'test-1',
      name: 'Test Investment',
      initial_balance_cents: 1000000, // $10,000
      monthly_contribution_cents: 50000, // $500/month
      annual_return_bps: 700, // 7%
      tax_status: 'taxable',
      tax_rate_bps: 2500, // 25%
      inflation_rate_bps: 300, // 3%
    };

    it('should calculate growth over time', () => {
      const result = calculateInvestmentGrowth(basicInvestment, defaultOptions);

      expect(result.schedule).toHaveLength(120); // 10 years * 12 months
      expect(result.final_balance_cents).toBeGreaterThan(basicInvestment.initial_balance_cents);
      expect(result.total_interest_cents).toBeGreaterThan(0);
    });

    it('should accumulate contributions', () => {
      const result = calculateInvestmentGrowth(basicInvestment, defaultOptions);

      const expectedContributions =
        basicInvestment.initial_balance_cents +
        basicInvestment.monthly_contribution_cents * 120;
      expect(result.total_contributions_cents).toBe(expectedContributions);
    });

    it('should show growth from compound interest', () => {
      const result = calculateInvestmentGrowth(basicInvestment, defaultOptions);

      // Final balance should exceed total contributions due to compound growth
      expect(result.final_balance_cents).toBeGreaterThan(result.total_contributions_cents);
      expect(result.total_interest_cents).toBe(
        result.final_balance_cents - result.total_contributions_cents
      );
    });

    it('should generate correct monthly schedule', () => {
      const result = calculateInvestmentGrowth(basicInvestment, defaultOptions);

      const firstMonth = result.schedule[0];
      expect(firstMonth.month).toBe(1);
      expect(firstMonth.contribution_cents).toBe(basicInvestment.monthly_contribution_cents);
      expect(firstMonth.interest_earned_cents).toBeGreaterThan(0);
      expect(firstMonth.cumulative_contributions_cents).toBe(
        basicInvestment.initial_balance_cents + basicInvestment.monthly_contribution_cents
      );

      // Balance should grow each month
      for (let i = 1; i < result.schedule.length; i++) {
        expect(result.schedule[i].balance_cents).toBeGreaterThan(
          result.schedule[i - 1].balance_cents
        );
      }
    });
  });

  describe('different return rates', () => {
    const baseInvestment: InvestmentInput = {
      id: 'test',
      name: 'Test',
      initial_balance_cents: 1000000, // $10,000
      monthly_contribution_cents: 0,
      annual_return_bps: 0,
      tax_status: 'taxable',
      tax_rate_bps: 0,
      inflation_rate_bps: 0,
    };

    it('should handle 0% return', () => {
      const investment = { ...baseInvestment, annual_return_bps: 0 };
      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        include_inflation: false,
        include_taxes: false,
      });

      expect(result.final_balance_cents).toBe(investment.initial_balance_cents);
      expect(result.total_interest_cents).toBe(0);
    });

    it('should handle 5% return', () => {
      const investment = { ...baseInvestment, annual_return_bps: 500 };
      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        years: 1,
        include_inflation: false,
        include_taxes: false,
      });

      // After 1 year at 5%, $10,000 should be ~$10,500 (exact with monthly compounding)
      expect(result.final_balance_cents).toBeGreaterThanOrEqual(1050000);
      expect(result.final_balance_cents).toBeLessThan(1060000);
    });

    it('should handle 10% return', () => {
      const investment = { ...baseInvestment, annual_return_bps: 1000 };
      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        years: 1,
        include_inflation: false,
        include_taxes: false,
      });

      // After 1 year at 10%, $10,000 should be ~$11,000 with monthly compounding
      expect(result.final_balance_cents).toBeGreaterThanOrEqual(1099000);
      expect(result.final_balance_cents).toBeLessThan(1110000);
    });

    it('should handle 20% return (aggressive)', () => {
      const investment = { ...baseInvestment, annual_return_bps: 2000 };
      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        years: 5,
        include_inflation: false,
        include_taxes: false,
      });

      // At 20% for 5 years, should more than double
      expect(result.final_balance_cents).toBeGreaterThan(2000000);
    });
  });

  describe('inflation adjustment', () => {
    const investment: InvestmentInput = {
      id: 'test',
      name: 'Test',
      initial_balance_cents: 1000000,
      monthly_contribution_cents: 0,
      annual_return_bps: 700, // 7%
      tax_status: 'taxable',
      tax_rate_bps: 0,
      inflation_rate_bps: 300, // 3%
    };

    it('should calculate real (inflation-adjusted) balance', () => {
      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        include_inflation: true,
        include_taxes: false,
      });

      // Real balance should be less than nominal balance
      expect(result.final_real_balance_cents).toBeLessThan(result.final_balance_cents);
    });

    it('should show purchasing power erosion', () => {
      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        years: 20,
        include_inflation: true,
        include_taxes: false,
      });

      // Over 20 years, inflation significantly reduces real value
      const lastMonth = result.schedule[result.schedule.length - 1];
      expect(lastMonth.real_balance_cents).toBeLessThan(lastMonth.balance_cents * 0.7);
    });

    it('should track inflation correctly in schedule', () => {
      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        include_inflation: true,
        include_taxes: false,
      });

      // First month should have minimal inflation impact
      const firstMonth = result.schedule[0];
      expect(firstMonth.real_balance_cents).toBeLessThan(firstMonth.balance_cents);
      expect(firstMonth.real_balance_cents).toBeGreaterThan(firstMonth.balance_cents * 0.99);
    });
  });

  describe('edge cases', () => {
    it('should handle zero years', () => {
      const investment: InvestmentInput = {
        id: 'test',
        name: 'Test',
        initial_balance_cents: 1000000,
        monthly_contribution_cents: 50000,
        annual_return_bps: 700,
        tax_status: 'taxable',
        tax_rate_bps: 2500,
        inflation_rate_bps: 300,
      };

      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        years: 0,
      });

      expect(result.schedule).toHaveLength(0);
      expect(result.final_balance_cents).toBe(investment.initial_balance_cents);
    });

    it('should handle zero initial balance', () => {
      const investment: InvestmentInput = {
        id: 'test',
        name: 'Test',
        initial_balance_cents: 0,
        monthly_contribution_cents: 50000,
        annual_return_bps: 700,
        tax_status: 'taxable',
        tax_rate_bps: 2500,
        inflation_rate_bps: 300,
      };

      const result = calculateInvestmentGrowth(investment, {
        ...defaultOptions,
        years: 5,
      });

      expect(result.total_contributions_cents).toBe(50000 * 60);
      expect(result.final_balance_cents).toBeGreaterThan(result.total_contributions_cents);
    });

    it('should handle zero monthly contribution', () => {
      const investment: InvestmentInput = {
        id: 'test',
        name: 'Test',
        initial_balance_cents: 1000000,
        monthly_contribution_cents: 0,
        annual_return_bps: 700,
        tax_status: 'taxable',
        tax_rate_bps: 2500,
        inflation_rate_bps: 300,
      };

      const result = calculateInvestmentGrowth(investment, defaultOptions);

      expect(result.total_contributions_cents).toBe(investment.initial_balance_cents);
      expect(result.final_balance_cents).toBeGreaterThan(investment.initial_balance_cents);
    });
  });
});

describe('calculateTaxImpact', () => {
  it('should calculate no tax for tax_free accounts', () => {
    const result = calculateTaxImpact(100000, 'tax_free', 2500, 200000);

    expect(result.tax_impact_cents).toBe(0);
    expect(result.after_tax_balance_cents).toBe(200000);
  });

  it('should calculate tax on full withdrawal for tax_deferred', () => {
    const result = calculateTaxImpact(100000, 'tax_deferred', 2500, 200000);

    // 25% tax on full $2,000 balance = $500
    expect(result.tax_impact_cents).toBe(50000);
    expect(result.after_tax_balance_cents).toBe(150000);
  });

  it('should calculate tax only on gains for taxable accounts', () => {
    const result = calculateTaxImpact(100000, 'taxable', 2500, 200000);

    // 25% tax on $1,000 gains = $250
    expect(result.tax_impact_cents).toBe(25000);
    expect(result.after_tax_balance_cents).toBe(175000);
  });

  it('should handle different tax rates', () => {
    const lowTax = calculateTaxImpact(100000, 'taxable', 1000, 200000); // 10%
    const highTax = calculateTaxImpact(100000, 'taxable', 4000, 200000); // 40%

    expect(lowTax.tax_impact_cents).toBe(10000); // $100
    expect(highTax.tax_impact_cents).toBe(40000); // $400
  });
});

describe('calculateRetirementProjection', () => {
  const retirementInvestment: InvestmentInput = {
    id: 'retirement',
    name: '401k',
    initial_balance_cents: 5000000, // $50,000
    monthly_contribution_cents: 100000, // $1,000/month
    annual_return_bps: 700, // 7%
    tax_status: 'tax_deferred',
    tax_rate_bps: 2500,
    inflation_rate_bps: 300,
  };

  it('should calculate if target is achievable', () => {
    const result = calculateRetirementProjection(
      retirementInvestment,
      100000000, // $1 million target
      30
    );

    expect(result.projection.target_achievable).toBe(true);
    expect(result.projection.months_to_target).not.toBeNull();
    expect(result.shortfall_cents).toBeNull();
  });

  it('should identify unreachable targets', () => {
    const result = calculateRetirementProjection(
      retirementInvestment,
      1000000000, // $10 million target (likely unreachable in 10 years)
      10
    );

    expect(result.projection.target_achievable).toBe(false);
    expect(result.shortfall_cents).not.toBeNull();
    expect(result.shortfall_cents).toBeGreaterThan(0);
  });

  it('should calculate 4% rule income', () => {
    const result = calculateRetirementProjection(
      retirementInvestment,
      100000000, // $1 million
      30
    );

    // Monthly income should be approximately (final_balance * 0.04 / 12)
    expect(result.monthly_income_cents).toBeGreaterThan(0);
  });

  it('should recommend higher contribution if needed', () => {
    const result = calculateRetirementProjection(
      { ...retirementInvestment, monthly_contribution_cents: 10000 }, // Only $100/month
      500000000, // $5 million target
      30
    );

    // Should recommend more than current contribution
    expect(result.recommended_contribution_cents).toBeGreaterThan(10000);
  });
});

describe('compareDebtVsInvest', () => {
  const debts: DebtInput[] = [
    {
      id: 'credit-card',
      name: 'Credit Card',
      balance_cents: 500000, // $5,000
      apr_bps: 2000, // 20%
      min_payment_cents: 15000, // $150
    },
    {
      id: 'car-loan',
      name: 'Car Loan',
      balance_cents: 1000000, // $10,000
      apr_bps: 600, // 6%
      min_payment_cents: 30000, // $300
    },
  ];

  const investment: InvestmentInput = {
    id: 'invest',
    name: 'Index Fund',
    initial_balance_cents: 0,
    monthly_contribution_cents: 0,
    annual_return_bps: 800, // 8%
    tax_status: 'taxable',
    tax_rate_bps: 2500,
    inflation_rate_bps: 300,
  };

  it('should compare multiple extra payment amounts', () => {
    const result = compareDebtVsInvest(
      debts,
      investment,
      [10000, 25000, 50000], // $100, $250, $500 extra
      10
    );

    expect(result.scenarios).toHaveLength(3);
    result.scenarios.forEach((scenario) => {
      expect(scenario.debt_interest_saved_cents).toBeGreaterThanOrEqual(0);
      expect(scenario.investment_growth_cents).toBeGreaterThanOrEqual(0);
      expect(['pay_debt', 'invest']).toContain(scenario.recommended);
    });
  });

  it('should calculate weighted debt APR', () => {
    const result = compareDebtVsInvest(debts, investment, [25000], 10);

    // Weighted APR should be between 6% and 20%
    expect(result.summary.weighted_debt_apr_bps).toBeGreaterThan(600);
    expect(result.summary.weighted_debt_apr_bps).toBeLessThan(2000);
  });

  it('should provide recommendation based on rates', () => {
    // High debt APR, low investment return - should recommend paying debt
    const highDebtResult = compareDebtVsInvest(
      [{ ...debts[0], apr_bps: 2500 }], // 25% APR credit card
      { ...investment, annual_return_bps: 700 }, // 7% return
      [25000],
      10
    );
    expect(highDebtResult.summary.recommendation).toBe('pay_debt');

    // Low debt APR, high investment return - should recommend investing
    const lowDebtResult = compareDebtVsInvest(
      [{ ...debts[1], apr_bps: 400 }], // 4% APR loan
      { ...investment, annual_return_bps: 1000 }, // 10% return
      [25000],
      10
    );
    expect(lowDebtResult.summary.recommendation).toBe('invest');
  });

  it('should calculate breakeven return', () => {
    const result = compareDebtVsInvest(debts, investment, [25000], 10);

    // Breakeven should equal weighted debt APR
    expect(result.breakeven_return_bps).toBe(result.summary.weighted_debt_apr_bps);
  });

  it('should recommend split when rates are close', () => {
    const closeRates = compareDebtVsInvest(
      [{ ...debts[1], apr_bps: 700 }], // 7% APR
      { ...investment, annual_return_bps: 800 }, // 8% return (only 1% difference)
      [25000],
      10
    );

    expect(closeRates.summary.recommendation).toBe('split');
  });
});

describe('compareInvestmentStrategies', () => {
  const investments: InvestmentInput[] = [
    {
      id: 'conservative',
      name: 'Bonds',
      initial_balance_cents: 1000000,
      monthly_contribution_cents: 50000,
      annual_return_bps: 400, // 4%
      tax_status: 'taxable',
      tax_rate_bps: 2500,
      inflation_rate_bps: 300,
    },
    {
      id: 'moderate',
      name: 'Balanced Fund',
      initial_balance_cents: 1000000,
      monthly_contribution_cents: 50000,
      annual_return_bps: 700, // 7%
      tax_status: 'taxable',
      tax_rate_bps: 2500,
      inflation_rate_bps: 300,
    },
    {
      id: 'aggressive',
      name: 'Stock Index',
      initial_balance_cents: 1000000,
      monthly_contribution_cents: 50000,
      annual_return_bps: 1000, // 10%
      tax_status: 'taxable',
      tax_rate_bps: 2500,
      inflation_rate_bps: 300,
    },
  ];

  it('should project all investments', () => {
    const result = compareInvestmentStrategies(investments, 10);

    expect(result.projections).toHaveLength(3);
    result.projections.forEach((p) => {
      expect(p.projection.final_balance_cents).toBeGreaterThan(0);
    });
  });

  it('should identify best performing investment', () => {
    const result = compareInvestmentStrategies(investments, 10);

    // Aggressive (10% return) should outperform
    expect(result.best_return_id).toBe('aggressive');
  });

  it('should calculate total portfolio value', () => {
    const result = compareInvestmentStrategies(investments, 10);

    const expectedTotal = result.projections.reduce(
      (sum, p) => sum + p.projection.after_tax_balance_cents,
      0
    );
    expect(result.total_value_cents).toBe(expectedTotal);
  });

  it('should handle single investment', () => {
    const result = compareInvestmentStrategies([investments[0]], 10);

    expect(result.projections).toHaveLength(1);
    expect(result.best_return_id).toBe('conservative');
  });
});

describe('integration scenarios', () => {
  it('should handle realistic 30-year retirement scenario', () => {
    const retirement: InvestmentInput = {
      id: '401k',
      name: '401k Account',
      initial_balance_cents: 2500000, // $25,000 starting
      monthly_contribution_cents: 50000, // $500/month
      annual_return_bps: 700, // 7% historical average
      tax_status: 'tax_deferred',
      tax_rate_bps: 2200, // 22% tax bracket
      inflation_rate_bps: 250, // 2.5% inflation
    };

    const result = calculateInvestmentGrowth(retirement, {
      years: 30,
      include_inflation: true,
      include_taxes: true,
      compound_frequency: 'monthly',
    });

    // After 30 years, should have significant growth
    expect(result.final_balance_cents).toBeGreaterThan(50000000); // > $500k
    expect(result.total_contributions_cents).toBe(
      2500000 + 50000 * 360 // Initial + 30 years of contributions
    );
    expect(result.total_interest_cents).toBeGreaterThan(result.total_contributions_cents);
  });

  it('should compare emergency fund vs paying down debt', () => {
    const creditCardDebt: DebtInput[] = [
      {
        id: 'cc',
        name: 'Credit Card',
        balance_cents: 800000, // $8,000
        apr_bps: 2100, // 21%
        min_payment_cents: 20000,
      },
    ];

    const savingsAccount: InvestmentInput = {
      id: 'savings',
      name: 'HYSA',
      initial_balance_cents: 0,
      monthly_contribution_cents: 0,
      annual_return_bps: 450, // 4.5%
      tax_status: 'taxable',
      tax_rate_bps: 2500,
      inflation_rate_bps: 300,
    };

    const result = compareDebtVsInvest(
      creditCardDebt,
      savingsAccount,
      [30000], // $300 extra
      5
    );

    // Should strongly recommend paying off 21% APR debt over 4.5% savings
    expect(result.summary.recommendation).toBe('pay_debt');
    expect(result.scenarios[0].debt_interest_saved_cents).toBeGreaterThan(
      result.scenarios[0].investment_growth_cents
    );
  });
});
