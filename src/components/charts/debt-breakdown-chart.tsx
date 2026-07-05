'use client';

import { memo, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Debt } from '@/types/database';

interface DebtBreakdownChartProps {
  debts: Debt[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(221, 83%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(316, 72%, 52%)',
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export const DebtBreakdownChart = memo(function DebtBreakdownChart({
  debts,
}: DebtBreakdownChartProps) {
  const data = useMemo(
    () =>
      debts.map((debt) => ({
        name: debt.name,
        value: debt.balance_cents / 100,
        apr: debt.apr_bps / 100,
      })),
    [debts]
  );

  const totalDebt = useMemo(() => debts.reduce((sum, d) => sum + d.balance_cents, 0), [debts]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-md">
                  <p className="font-medium">{data.name}</p>
                  <p className="text-sm">
                    Balance: {formatCurrency(data.value * 100)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    APR: {data.apr.toFixed(2)}%
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-lg font-bold"
        >
          {formatCurrency(totalDebt)}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
});
