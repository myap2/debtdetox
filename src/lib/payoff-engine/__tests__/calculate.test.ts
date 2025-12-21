import { calculatePayoff, compareStrategies } from '../calculate';
import type { DebtInput } from '../types';

describe('calculatePayoff', () => {
  describe('with empty debts', () => {
    it('should return zero values for empty debt array', () => {
      const result = calculatePayoff([], 'avalanche', 0);

      expect(result.schedule).toHaveLength(0);
      expect(result.total_interest_cents).toBe(0);
      expect(result.total_paid_cents).toBe(0);
      expect(result.months_to_payoff).toBe(0);
      expect(result.debts_payoff_order).toHaveLength(0);
    });
  });

  describe('with single debt', () => {
    const singleDebt: DebtInput[] = [
      {
        id: 'debt-1',
        name: 'Credit Card',
        balance_cents: 100000, // $1,000
        apr_bps: 2000, // 20%
        min_payment_cents: 5000, // $50
      },
    ];

    it('should calculate payoff for a single debt', () => {
      const result = calculatePayoff(singleDebt, 'avalanche', 0);

      expect(result.months_to_payoff).toBeGreaterThan(0);
      expect(result.total_interest_cents).toBeGreaterThan(0);
      expect(result.total_paid_cents).toBeGreaterThan(singleDebt[0].balance_cents);
      expect(result.debts_payoff_order).toHaveLength(1);
      expect(result.debts_payoff_order[0].id).toBe('debt-1');
    });

    it('should pay off faster with extra payments', () => {
      const withoutExtra = calculatePayoff(singleDebt, 'avalanche', 0);
      const withExtra = calculatePayoff(singleDebt, 'avalanche', 5000); // $50 extra

      expect(withExtra.months_to_payoff).toBeLessThan(withoutExtra.months_to_payoff);
      expect(withExtra.total_interest_cents).toBeLessThan(withoutExtra.total_interest_cents);
    });
  });

  describe('avalanche strategy', () => {
    const debts: DebtInput[] = [
      {
        id: 'low-apr',
        name: 'Low APR Loan',
        balance_cents: 500000, // $5,000
        apr_bps: 500, // 5%
        min_payment_cents: 10000, // $100
      },
      {
        id: 'high-apr',
        name: 'High APR Card',
        balance_cents: 300000, // $3,000
        apr_bps: 2500, // 25%
        min_payment_cents: 7500, // $75
      },
      {
        id: 'medium-apr',
        name: 'Medium APR Loan',
        balance_cents: 200000, // $2,000
        apr_bps: 1200, // 12%
        min_payment_cents: 5000, // $50
      },
    ];

    it('should prioritize highest APR debt for extra payments', () => {
      // With extra payments, avalanche focuses on high APR
      const result = calculatePayoff(debts, 'avalanche', 20000);

      // High APR should be paid off before low APR
      const highAprOrder = result.debts_payoff_order.findIndex(d => d.id === 'high-apr');
      const lowAprOrder = result.debts_payoff_order.findIndex(d => d.id === 'low-apr');
      expect(highAprOrder).toBeLessThan(lowAprOrder);
    });

    it('should minimize total interest paid', () => {
      const avalanche = calculatePayoff(debts, 'avalanche', 10000);
      const snowball = calculatePayoff(debts, 'snowball', 10000);

      // Avalanche should pay less or equal interest
      expect(avalanche.total_interest_cents).toBeLessThanOrEqual(snowball.total_interest_cents);
    });
  });

  describe('snowball strategy', () => {
    const debts: DebtInput[] = [
      {
        id: 'large-balance',
        name: 'Large Balance',
        balance_cents: 1000000, // $10,000
        apr_bps: 1500, // 15%
        min_payment_cents: 20000, // $200
      },
      {
        id: 'small-balance',
        name: 'Small Balance',
        balance_cents: 50000, // $500
        apr_bps: 2000, // 20%
        min_payment_cents: 2500, // $25
      },
      {
        id: 'medium-balance',
        name: 'Medium Balance',
        balance_cents: 300000, // $3,000
        apr_bps: 1800, // 18%
        min_payment_cents: 7500, // $75
      },
    ];

    it('should pay off smallest balance first', () => {
      const result = calculatePayoff(debts, 'snowball', 0);

      // Small balance ($500) should be paid off first
      expect(result.debts_payoff_order[0].id).toBe('small-balance');
      // Medium balance ($3,000) should be second
      expect(result.debts_payoff_order[1].id).toBe('medium-balance');
      // Large balance ($10,000) should be last
      expect(result.debts_payoff_order[2].id).toBe('large-balance');
    });
  });

  describe('interest calculations', () => {
    it('should calculate monthly interest correctly', () => {
      const debt: DebtInput[] = [
        {
          id: 'test',
          name: 'Test',
          balance_cents: 100000, // $1,000
          apr_bps: 1200, // 12% APR = 1% monthly
          min_payment_cents: 100000, // Pay it all in one month
        },
      ];

      const result = calculatePayoff(debt, 'avalanche', 0);

      // With 12% APR on $1,000, first month interest should be ~$10
      expect(result.total_interest_cents).toBeGreaterThan(0);
      expect(result.total_interest_cents).toBeLessThan(1500); // Less than $15
      // Should take 1-2 months depending on interest
      expect(result.months_to_payoff).toBeLessThanOrEqual(2);
    });

    it('should accumulate interest over time', () => {
      const debt: DebtInput[] = [
        {
          id: 'test',
          name: 'Test',
          balance_cents: 100000, // $1,000
          apr_bps: 1200, // 12% APR
          min_payment_cents: 1000, // Very small payment to see interest accumulation
        },
      ];

      const result = calculatePayoff(debt, 'avalanche', 0);

      // With tiny payments, it should take a long time
      expect(result.months_to_payoff).toBeGreaterThan(100);
      // Total interest should be significant relative to principal
      expect(result.total_interest_cents).toBeGreaterThan(debt[0].balance_cents);
    });
  });

  describe('monthly schedule', () => {
    it('should generate correct monthly breakdowns', () => {
      const debt: DebtInput[] = [
        {
          id: 'test',
          name: 'Test',
          balance_cents: 100000,
          apr_bps: 1200,
          min_payment_cents: 10000,
        },
      ];

      const result = calculatePayoff(debt, 'avalanche', 0);

      expect(result.schedule.length).toBe(result.months_to_payoff);

      // Check first month
      const firstMonth = result.schedule[0];
      expect(firstMonth.month).toBe(1);
      expect(firstMonth.payments).toHaveLength(1);
      expect(firstMonth.total_payment_cents).toBeGreaterThan(0);
      expect(firstMonth.total_remaining_cents).toBeLessThan(100000);

      // Check last month
      const lastMonth = result.schedule[result.schedule.length - 1];
      expect(lastMonth.total_remaining_cents).toBe(0);
    });

    it('should track principal and interest separately', () => {
      const debt: DebtInput[] = [
        {
          id: 'test',
          name: 'Test',
          balance_cents: 100000,
          apr_bps: 1200,
          min_payment_cents: 10000,
        },
      ];

      const result = calculatePayoff(debt, 'avalanche', 0);
      const firstPayment = result.schedule[0].payments[0];

      expect(firstPayment.interest_cents).toBeGreaterThan(0);
      expect(firstPayment.principal_cents).toBeGreaterThan(0);
      expect(firstPayment.interest_cents + firstPayment.principal_cents).toBe(firstPayment.payment_cents);
    });
  });

  describe('edge cases', () => {
    it('should handle zero balance debts', () => {
      const debts: DebtInput[] = [
        {
          id: 'zero',
          name: 'Zero Balance',
          balance_cents: 0,
          apr_bps: 2000,
          min_payment_cents: 5000,
        },
      ];

      const result = calculatePayoff(debts, 'avalanche', 0);
      expect(result.months_to_payoff).toBe(0);
    });

    it('should handle very high APR', () => {
      const debt: DebtInput[] = [
        {
          id: 'high-apr',
          name: 'Payday Loan',
          balance_cents: 50000,
          apr_bps: 40000, // 400% APR
          min_payment_cents: 10000,
        },
      ];

      const result = calculatePayoff(debt, 'avalanche', 0);
      expect(result.months_to_payoff).toBeGreaterThan(0);
      expect(result.total_interest_cents).toBeGreaterThan(debt[0].balance_cents);
    });

    it('should handle zero APR', () => {
      const debt: DebtInput[] = [
        {
          id: 'zero-apr',
          name: 'Interest Free',
          balance_cents: 100000,
          apr_bps: 0,
          min_payment_cents: 10000,
        },
      ];

      const result = calculatePayoff(debt, 'avalanche', 0);
      expect(result.total_interest_cents).toBe(0);
      expect(result.total_paid_cents).toBe(100000);
      expect(result.months_to_payoff).toBe(10);
    });
  });
});

describe('compareStrategies', () => {
  const debts: DebtInput[] = [
    {
      id: 'small-high-apr',
      name: 'Small High APR',
      balance_cents: 100000, // $1,000
      apr_bps: 2500, // 25%
      min_payment_cents: 5000,
    },
    {
      id: 'large-low-apr',
      name: 'Large Low APR',
      balance_cents: 500000, // $5,000
      apr_bps: 800, // 8%
      min_payment_cents: 10000,
    },
  ];

  it('should return both strategies', () => {
    const result = compareStrategies(debts, 5000);

    expect(result.snowball).toBeDefined();
    expect(result.avalanche).toBeDefined();
    expect(result.snowball.months_to_payoff).toBeGreaterThan(0);
    expect(result.avalanche.months_to_payoff).toBeGreaterThan(0);
  });

  it('should calculate savings between strategies', () => {
    const result = compareStrategies(debts, 5000);

    expect(result.savings_cents).toBeGreaterThanOrEqual(0);
    expect(result.faster_strategy).toMatch(/^(snowball|avalanche)$/);
    expect(result.months_saved).toBeGreaterThanOrEqual(0);
  });

  it('should identify avalanche as saving more on interest', () => {
    const result = compareStrategies(debts, 5000);

    // With these debts, avalanche should save money
    expect(result.avalanche.total_interest_cents).toBeLessThanOrEqual(
      result.snowball.total_interest_cents
    );
  });
});
