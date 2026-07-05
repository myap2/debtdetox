'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, CalendarDays, DollarSign, RefreshCw, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { DebtPayoffChart } from '@/components/charts';
import { useSavedPlan, useRefreshPlan } from '@/hooks/use-saved-plans';
import { formatCurrency, formatFullDate, formatMonthYear } from '@/lib/format';
import type { MonthlyBreakdown } from '@/lib/payoff-engine';

export default function SavedPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: plan, isLoading, error } = useSavedPlan(id);
  const refreshPlan = useRefreshPlan();
  const [confirmingRefresh, setConfirmingRefresh] = useState(false);

  const snapshot = plan?.snapshot?.snapshot_json ?? null;

  // The chart expects Date objects; snapshot dates round-trip as ISO strings
  const chartSchedule: MonthlyBreakdown[] = useMemo(
    () =>
      (snapshot?.result.schedule ?? []).map((month) => ({
        ...month,
        date: new Date(month.date),
      })),
    [snapshot]
  );

  async function handleRefresh() {
    try {
      await refreshPlan.mutateAsync(id);
      setConfirmingRefresh(false);
      toast.success('Plan updated with current balances');
    } catch (refreshError) {
      toast.error(
        refreshError instanceof Error ? refreshError.message : 'Failed to refresh plan'
      );
    }
  }

  if (error) {
    return (
      <div className="flex flex-col">
        <Header title="Saved Plan" description="A snapshot of your payoff strategy" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">This plan could not be found.</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/plans">Back to saved plans</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const snapshotTotalDebt = snapshot
    ? snapshot.debts.reduce((sum, d) => sum + d.balance_cents, 0)
    : 0;

  return (
    <div className="flex flex-col">
      <Header
        title={plan?.name ?? 'Saved Plan'}
        description="A snapshot of your payoff strategy"
      />

      <div className="flex-1 space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" asChild className="w-fit -ml-2">
            <Link href="/plans">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Saved Plans
            </Link>
          </Button>

          <Button
            variant="outline"
            onClick={() => setConfirmingRefresh(true)}
            disabled={!plan || refreshPlan.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshPlan.isPending ? 'animate-spin' : ''}`}
            />
            Update using current balances
          </Button>
        </div>

        {isLoading || !plan ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-72" />
          </div>
        ) : !snapshot ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">
                This plan has no saved snapshot. Use &quot;Update using current
                balances&quot; to generate one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Plan metadata */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">
                {snapshot.strategy}
              </Badge>
              {snapshot.extra_payment_cents > 0 && (
                <Badge variant="outline">
                  +{formatCurrency(snapshot.extra_payment_cents, { compact: true })}/mo extra
                </Badge>
              )}
              <span>
                Saved {formatFullDate(plan.created_at)} · balances as of{' '}
                {formatFullDate(plan.snapshot!.created_at)}
              </span>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Debt-Free Date</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMonthYear(snapshot.result.debt_free_date)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {snapshot.result.months_to_payoff} months from save date
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Interest</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(snapshot.result.total_interest_cents)}
                  </div>
                  <p className="text-xs text-muted-foreground">Over the payoff period</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total to Pay</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(snapshot.result.total_paid_cents)}
                  </div>
                  <p className="text-xs text-muted-foreground">Principal + Interest</p>
                </CardContent>
              </Card>
            </div>

            {/* Strategy comparison summary */}
            <Card>
              <CardContent className="py-4">
                <p className="text-center text-sm">
                  When saved, the{' '}
                  <span className="font-semibold capitalize">
                    {snapshot.comparison.faster_strategy}
                  </span>{' '}
                  method saved{' '}
                  <span className="font-semibold">
                    {formatCurrency(snapshot.comparison.savings_cents)}
                  </span>{' '}
                  in interest
                  {snapshot.comparison.months_saved > 0 && (
                    <>
                      {' '}and finished{' '}
                      <span className="font-semibold">
                        {snapshot.comparison.months_saved} months
                      </span>{' '}
                      sooner
                    </>
                  )}{' '}
                  compared to the alternative.
                </p>
              </CardContent>
            </Card>

            {/* Payoff Timeline Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payoff Timeline</CardTitle>
                <CardDescription>Projected debt reduction from the save date</CardDescription>
              </CardHeader>
              <CardContent>
                <DebtPayoffChart schedule={chartSchedule} />
              </CardContent>
            </Card>

            {/* Debts snapshot */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Debts in This Plan</CardTitle>
                <CardDescription>Balances at the time the plan was saved</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">APR</TableHead>
                        <TableHead className="text-right">Min Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshot.debts.map((debt) => (
                        <TableRow key={debt.id}>
                          <TableCell className="font-medium">{debt.name}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(debt.balance_cents)}
                          </TableCell>
                          <TableCell className="text-right">
                            {(debt.apr_bps / 100).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(debt.min_payment_cents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Payoff Order */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payoff Order</CardTitle>
                <CardDescription>
                  {snapshot.strategy === 'avalanche'
                    ? 'Highest interest rate debts first'
                    : 'Smallest balance debts first'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {snapshot.result.debts_payoff_order.map((debt, index) => (
                    <div key={debt.id} className="flex items-center gap-4">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{debt.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Paid off in{' '}
                          {formatMonthYear(
                            snapshot.result.schedule[debt.payoff_month - 1]?.date ?? new Date()
                          )}
                        </p>
                      </div>
                      <Badge variant="secondary">Month {debt.payoff_month}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Schedule (first 12 months) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Schedule</CardTitle>
                <CardDescription>First 12 months of payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshot.result.schedule.slice(0, 12).map((month) => {
                        const progress =
                          snapshotTotalDebt > 0
                            ? ((snapshotTotalDebt - month.total_remaining_cents) /
                                snapshotTotalDebt) *
                              100
                            : 0;
                        return (
                          <TableRow key={month.month}>
                            <TableCell>{formatMonthYear(month.date)}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(month.total_payment_cents)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(month.total_remaining_cents)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress value={progress} className="h-2 w-16" />
                                <span className="text-xs text-muted-foreground">
                                  {progress.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {snapshot.result.schedule.length > 12 && (
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    + {snapshot.result.schedule.length - 12} more months
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Refresh confirmation */}
      <Dialog open={confirmingRefresh} onOpenChange={setConfirmingRefresh}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update using current balances?</DialogTitle>
            <DialogDescription>
              This recalculates the plan from your current debts and replaces the view
              with a fresh snapshot. The plan&apos;s strategy and extra payment are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingRefresh(false)}>
              Cancel
            </Button>
            <Button onClick={handleRefresh} disabled={refreshPlan.isPending}>
              {refreshPlan.isPending ? 'Updating...' : 'Update Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
