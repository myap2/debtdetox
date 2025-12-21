'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarDays, DollarSign, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { DebtPayoffChart, StrategyComparisonChart } from '@/components/charts';
import type { PayoffResult, PayoffStrategy } from '@/lib/payoff-engine';

interface ComparisonResult {
  snowball: PayoffResult;
  avalanche: PayoffResult;
  savings_cents: number;
  faster_strategy: PayoffStrategy;
  months_saved: number;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export default function PlanPage() {
  const [extraPayment, setExtraPayment] = useState('0');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasDebts, setHasDebts] = useState<boolean | null>(null);

  async function generatePlan() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compare: true,
          extra_payment_cents: Math.round(parseFloat(extraPayment || '0') * 100),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error === 'No debts found') {
          setHasDebts(false);
          return;
        }
        throw new Error(error.error);
      }

      setHasDebts(true);
      const data = await response.json();
      setComparison(data);
    } catch (error) {
      console.error('Failed to generate plan:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    generatePlan();
  }, []);

  function handleRefresh() {
    generatePlan();
  }

  function renderPlanContent(result: PayoffResult, strategy: PayoffStrategy) {
    if (result.months_to_payoff === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <p>No payoff schedule to display</p>
        </div>
      );
    }

    const totalDebt = result.schedule[0]?.total_remaining_cents ?? 0;

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Debt-Free Date</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDate(result.debt_free_date)}</div>
              <p className="text-xs text-muted-foreground">
                {result.months_to_payoff} months from now
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Interest</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(result.total_interest_cents)}</div>
              <p className="text-xs text-muted-foreground">Over the payoff period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total to Pay</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(result.total_paid_cents)}</div>
              <p className="text-xs text-muted-foreground">Principal + Interest</p>
            </CardContent>
          </Card>
        </div>

        {/* Payoff Timeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payoff Timeline</CardTitle>
            <CardDescription>Projected debt reduction over time</CardDescription>
          </CardHeader>
          <CardContent>
            <DebtPayoffChart schedule={result.schedule} />
          </CardContent>
        </Card>

        {/* Payoff Order */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payoff Order</CardTitle>
            <CardDescription>
              {strategy === 'avalanche'
                ? 'Highest interest rate debts first'
                : 'Smallest balance debts first'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.debts_payoff_order.map((debt, index) => (
                <div key={debt.id} className="flex items-center gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{debt.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Paid off in {formatDate(result.schedule[debt.payoff_month - 1]?.date ?? new Date())}
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
                {result.schedule.slice(0, 12).map((month) => {
                  const progress = ((totalDebt - month.total_remaining_cents) / totalDebt) * 100;
                  return (
                    <TableRow key={month.month}>
                      <TableCell>{formatDate(month.date)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(month.total_payment_cents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(month.total_remaining_cents)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2">
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
            {result.schedule.length > 12 && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                + {result.schedule.length - 12} more months
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasDebts === false) {
    return (
      <div className="flex flex-col">
        <Header
          title="Payoff Plan"
          description="Choose your strategy and see your debt-free timeline"
        />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">Add debts to generate your payoff plan</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/debts">Add your first debt</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Payoff Plan"
        description="Choose your strategy and see your debt-free timeline"
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue="avalanche" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="avalanche">
                Avalanche
                {comparison && comparison.faster_strategy === 'avalanche' && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Saves more
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="snowball">
                Snowball
                {comparison && comparison.faster_strategy === 'snowball' && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Faster
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Label htmlFor="extra" className="whitespace-nowrap">
                Extra Monthly:
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="extra"
                  type="number"
                  min="0"
                  step="10"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(e.target.value)}
                  className="w-28 pl-7"
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {comparison && comparison.savings_cents > 0 && (
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CardContent className="py-4">
                <p className="text-center text-sm">
                  <span className="font-semibold">
                    {comparison.faster_strategy === 'avalanche' ? 'Avalanche' : 'Snowball'}
                  </span>{' '}
                  saves you{' '}
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(comparison.savings_cents)}
                  </span>{' '}
                  in interest
                  {comparison.months_saved > 0 && (
                    <>
                      {' '}and pays off{' '}
                      <span className="font-semibold">{comparison.months_saved} months</span> faster
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Strategy Comparison Chart */}
          {comparison && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Strategy Comparison
                </CardTitle>
                <CardDescription>
                  Compare avalanche and snowball methods side by side
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StrategyComparisonChart
                  avalanche={comparison.avalanche}
                  snowball={comparison.snowball}
                />
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : comparison ? (
            <>
              <TabsContent value="avalanche">
                <Card>
                  <CardHeader>
                    <CardTitle>Avalanche Method</CardTitle>
                    <CardDescription>
                      Pay off highest interest rate debts first. This saves the most money on interest.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderPlanContent(comparison.avalanche, 'avalanche')}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="snowball">
                <Card>
                  <CardHeader>
                    <CardTitle>Snowball Method</CardTitle>
                    <CardDescription>
                      Pay off smallest balance debts first. This provides quick wins and motivation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderPlanContent(comparison.snowball, 'snowball')}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}
