'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import type { DebtVsInvestScenario } from '@/lib/investment-engine';

interface DebtVsInvestChartProps {
  scenarios: DebtVsInvestScenario[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function DebtVsInvestChart({ scenarios }: DebtVsInvestChartProps) {
  const data = scenarios.map((scenario) => ({
    amount: formatCurrency(scenario.extra_payment_cents),
    amountCents: scenario.extra_payment_cents,
    debtSaved: scenario.debt_interest_saved_cents / 100,
    investGrowth: scenario.investment_growth_cents / 100,
    recommended: scenario.recommended,
    netBenefit: scenario.net_benefit_cents / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="amount"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          label={{
            value: 'Extra Monthly Payment',
            position: 'insideBottom',
            offset: -5,
            className: 'text-muted-foreground text-xs',
          }}
        />
        <YAxis
          tickFormatter={(value) =>
            value >= 1000
              ? `$${(value / 1000).toFixed(0)}k`
              : `$${value}`
          }
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const debtSaved = payload.find((p) => p.dataKey === 'debtSaved');
              const investGrowth = payload.find((p) => p.dataKey === 'investGrowth');
              const scenario = data.find((d) => d.amount === label);

              return (
                <div className="rounded-lg border bg-background p-3 shadow-md min-w-[200px]">
                  <p className="font-medium mb-2">Extra: {label}/month</p>
                  {debtSaved && (
                    <p className="text-sm text-red-600">
                      Debt Interest Saved: {formatCurrency((debtSaved.value as number) * 100)}
                    </p>
                  )}
                  {investGrowth && (
                    <p className="text-sm text-green-600">
                      Investment Growth: {formatCurrency((investGrowth.value as number) * 100)}
                    </p>
                  )}
                  {scenario && (
                    <p className={`text-sm font-medium mt-2 ${
                      scenario.recommended === 'invest' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Recommendation: {scenario.recommended === 'invest' ? 'Invest' : 'Pay Debt'}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        <Bar dataKey="debtSaved" name="Debt Interest Saved" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`debt-${index}`}
              fill={entry.recommended === 'pay_debt' ? 'hsl(0 72% 51%)' : 'hsl(0 72% 51% / 0.5)'}
            />
          ))}
        </Bar>
        <Bar dataKey="investGrowth" name="Investment Growth" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`invest-${index}`}
              fill={entry.recommended === 'invest' ? 'hsl(142 76% 36%)' : 'hsl(142 76% 36% / 0.5)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
