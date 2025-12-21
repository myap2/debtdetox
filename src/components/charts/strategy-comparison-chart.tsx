'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { PayoffResult } from '@/lib/payoff-engine';

interface StrategyComparisonChartProps {
  avalanche: PayoffResult;
  snowball: PayoffResult;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function StrategyComparisonChart({ avalanche, snowball }: StrategyComparisonChartProps) {
  const data = [
    {
      name: 'Avalanche',
      interest: avalanche.total_interest_cents / 100,
      months: avalanche.months_to_payoff,
      better: avalanche.total_interest_cents <= snowball.total_interest_cents,
    },
    {
      name: 'Snowball',
      interest: snowball.total_interest_cents / 100,
      months: snowball.months_to_payoff,
      better: snowball.total_interest_cents < avalanche.total_interest_cents,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Total Interest Paid</h4>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm">
                        Interest: {formatCurrency(data.interest * 100)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="interest" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.better ? 'hsl(var(--chart-2))' : 'hsl(var(--muted))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Months to Payoff</h4>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm">{data.months} months</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="months" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    (entry.name === 'Avalanche' && avalanche.months_to_payoff <= snowball.months_to_payoff) ||
                    (entry.name === 'Snowball' && snowball.months_to_payoff < avalanche.months_to_payoff)
                      ? 'hsl(var(--chart-1))'
                      : 'hsl(var(--muted))'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
