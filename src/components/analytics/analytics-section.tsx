'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Receipt,
  TrendingDown,
  Trophy,
  Flame,
  BarChart3,
  LineChart,
  PiggyBank,
  Percent,
} from 'lucide-react';
import { DebtReductionChart, MonthlyPaymentsChart } from '@/components/charts';
import { useAnalytics } from '@/hooks/use-analytics';
import { formatCurrency, formatFullDate } from '@/lib/format';

export function AnalyticsSection() {
  const { data: analytics, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className="mt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  if (analytics.payment_count === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Payment Analytics
          </CardTitle>
          <CardDescription>
            Track your progress as you log payments
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <PiggyBank className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium">No payments logged yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Record payments on your debts to see totals, trends, and interest saved here.
          </p>
          <Button asChild className="mt-4">
            <Link href="/debts">Go to Debts</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Payment stat tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.total_paid_cents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.payment_count} payment{analytics.payment_count === 1 ? '' : 's'}
              {analytics.last_payment_date
                ? ` · last on ${formatFullDate(analytics.last_payment_date)}`
                : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Payment</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.average_payment_cents)}
            </div>
            <p className="text-xs text-muted-foreground">
              Largest: {formatCurrency(analytics.largest_payment_cents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Interest Saved</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.interest_saved_cents)}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated, from payments you&apos;ve logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payment Streak</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.longest_streak_months} month
              {analytics.longest_streak_months === 1 ? '' : 's'}
            </div>
            <p className="text-xs text-muted-foreground">
              Longest run · current: {analytics.current_streak_months} month
              {analytics.current_streak_months === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payoff percentage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Percent className="h-4 w-4 text-muted-foreground" />
            Payoff Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress
              value={analytics.payoff_percentage}
              className="h-3 flex-1"
              aria-label={`${analytics.payoff_percentage.toFixed(1)}% of tracked debt paid off`}
            />
            <span className="text-lg font-bold">
              {analytics.payoff_percentage.toFixed(1)}%
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Of everything you&apos;ve tracked, {formatCurrency(analytics.current_total_balance_cents)}{' '}
            remains
          </p>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Debt Reduction Over Time
            </CardTitle>
            <CardDescription>
              Total balance by month, reconstructed from your payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DebtReductionChart history={analytics.balance_history} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Monthly Payments
            </CardTitle>
            <CardDescription>Amount paid toward debts each month</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyPaymentsChart points={analytics.monthly_payments} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
