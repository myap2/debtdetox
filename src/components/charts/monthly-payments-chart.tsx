'use client';

import { memo, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyPaymentPoint } from '@/lib/analytics';

interface MonthlyPaymentsChartProps {
  points: MonthlyPaymentPoint[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatMonthLabel(month: string): string {
  // month is YYYY-MM; parse as a local date to avoid UTC shifting
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

export const MonthlyPaymentsChart = memo(function MonthlyPaymentsChart({
  points,
}: MonthlyPaymentsChartProps) {
  const data = useMemo(
    () =>
      points.map((point) => ({
        month: formatMonthLabel(point.month),
        total: point.total_cents / 100,
        count: point.payment_count,
      })),
    [points]
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const point = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-md">
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">
                    Paid: {formatCurrency(point.total * 100)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {point.count} payment{point.count === 1 ? '' : 's'}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
});
