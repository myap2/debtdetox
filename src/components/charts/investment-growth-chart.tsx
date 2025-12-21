'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { MonthlyInvestmentBreakdown } from '@/lib/investment-engine';

interface InvestmentGrowthChartProps {
  schedule: MonthlyInvestmentBreakdown[];
  showContributions?: boolean;
  showRealBalance?: boolean;
  maxMonths?: number;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

export function InvestmentGrowthChart({
  schedule,
  showContributions = true,
  showRealBalance = false,
  maxMonths,
}: InvestmentGrowthChartProps) {
  // Sample data points for readability (every 12 months for long projections)
  const sampleInterval = schedule.length > 60 ? 12 : schedule.length > 24 ? 6 : 1;
  const sampledSchedule = schedule.filter((_, i) => i % sampleInterval === 0 || i === schedule.length - 1);
  const displaySchedule = maxMonths ? sampledSchedule.slice(0, maxMonths) : sampledSchedule;

  const data = displaySchedule.map((month) => ({
    date: formatDate(month.date),
    balance: month.balance_cents / 100,
    contributions: month.cumulative_contributions_cents / 100,
    growth: month.cumulative_interest_cents / 100,
    realBalance: month.real_balance_cents / 100,
  }));

  // Add starting point
  if (schedule.length > 0) {
    const firstMonth = schedule[0];
    const startingBalance = firstMonth.balance_cents - firstMonth.interest_earned_cents - firstMonth.contribution_cents;
    data.unshift({
      date: 'Start',
      balance: startingBalance / 100,
      contributions: startingBalance / 100,
      growth: 0,
      realBalance: startingBalance / 100,
    });
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorContributions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          tickFormatter={(value) =>
            value >= 1000000
              ? `$${(value / 1000000).toFixed(1)}M`
              : value >= 1000
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
              const balance = payload.find((p) => p.dataKey === 'balance');
              const contributions = payload.find((p) => p.dataKey === 'contributions');
              const growth = payload.find((p) => p.dataKey === 'growth');
              const realBalance = payload.find((p) => p.dataKey === 'realBalance');

              return (
                <div className="rounded-lg border bg-background p-3 shadow-md">
                  <p className="font-medium">{label}</p>
                  {balance && (
                    <p className="text-sm text-green-600">
                      Balance: {formatCurrency((balance.value as number) * 100)}
                    </p>
                  )}
                  {showContributions && contributions && (
                    <p className="text-sm text-blue-600">
                      Contributed: {formatCurrency((contributions.value as number) * 100)}
                    </p>
                  )}
                  {growth && (
                    <p className="text-sm text-muted-foreground">
                      Growth: {formatCurrency((growth.value as number) * 100)}
                    </p>
                  )}
                  {showRealBalance && realBalance && (
                    <p className="text-sm text-amber-600">
                      Real Value: {formatCurrency((realBalance.value as number) * 100)}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="balance"
          name="Total Balance"
          stroke="hsl(142 76% 36%)"
          strokeWidth={2}
          fill="url(#colorBalance)"
        />
        {showContributions && (
          <Area
            type="monotone"
            dataKey="contributions"
            name="Contributions"
            stroke="hsl(221 83% 53%)"
            strokeWidth={2}
            fill="url(#colorContributions)"
          />
        )}
        {showRealBalance && (
          <Area
            type="monotone"
            dataKey="realBalance"
            name="Real Value (Inflation Adj.)"
            stroke="hsl(38 92% 50%)"
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="url(#colorReal)"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
