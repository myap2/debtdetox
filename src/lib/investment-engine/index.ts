export {
  calculateInvestmentGrowth,
  calculateTaxImpact,
  calculateRetirementProjection,
  compareDebtVsInvest,
  compareInvestmentStrategies,
} from './calculate';

export type {
  InvestmentType,
  TaxStatus,
  CompoundFrequency,
  InvestmentInput,
  InvestmentCalculationOptions,
  MonthlyInvestmentBreakdown,
  InvestmentProjection,
  RetirementProjection,
  DebtVsInvestScenario,
  DebtVsInvestResult,
} from './types';

export { INVESTMENT_DEFAULTS } from './types';
