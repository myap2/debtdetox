'use client';

import { memo, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyBreakdown } from '@/lib/payoff-engine';

interface DebtPayoffChartProps {
  schedule: MonthlyBreakdown[];
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

export const DebtPayoffChart = memo(function DebtPayoffChart({
  schedule,
  maxMonths = 24,
}: DebtPayoffChartProps) {
  const data = useMemo(() => {
    const points = schedule.slice(0, maxMonths).map((month) => ({
      month: formatDate(month.date),
      remaining: month.total_remaining_cents / 100,
      payment: month.total_payment_cents / 100,
    }));

    // Add starting point
    if (schedule.length > 0) {
      const startingBalance = schedule[0].total_remaining_cents + schedule[0].total_payment_cents;
      points.unshift({
        month: 'Start',
        remaining: startingBalance / 100,
        payment: 0,
      });
    }
    return points;
  }, [schedule, maxMonths]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-3 shadow-md">
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">
                    Remaining: {formatCurrency(payload[0].value as number * 100)}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="remaining"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#colorRemaining)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
