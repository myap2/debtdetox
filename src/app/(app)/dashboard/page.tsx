'use client';

import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ArrowRight, CreditCard, Target, TrendingDown, CheckCircle2, BarChart3 } from 'lucide-react';
import { DebtPayoffChart, DebtBreakdownChart } from '@/components/charts';
import { useDebts } from '@/hooks/use-debts';
import { usePayoffPlan } from '@/hooks/use-payoff-plan';

// Analytics (with its chart bundle) loads lazily so it doesn't block first paint
const AnalyticsSection = dynamic(
  () => import('@/components/analytics/analytics-section').then((m) => m.AnalyticsSection),
  { ssr: false, loading: () => <Skeleton className="mt-6 h-64" /> }
);

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

export default function DashboardPage() {
  const { data: debts = [], isLoading: debtsLoading } = useDebts();
  const { data: plan, isLoading: planLoading } = usePayoffPlan(0);

  const isLoading = debtsLoading || planLoading;
  const totalDebt = debts.reduce((sum, d) => sum + d.balance_cents, 0);
  const hasDebts = debts.length > 0;
  const avalancheResult = plan?.avalanche;

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Overview of your debt payoff journey"
      />

      <div className="flex-1 p-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(totalDebt)}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasDebts ? `${debts.length} active debt${debts.length > 1 ? 's' : ''}` : 'Add your debts to get started'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Debt-Free Date</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : avalancheResult ? formatDate(avalancheResult.debt_free_date) : '--'}
              </div>
              <p className="text-xs text-muted-foreground">
                {avalancheResult
                  ? `${avalancheResult.months_to_payoff} months to go`
                  : 'Create a plan to see your timeline'}
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
                {isLoading ? '...' : avalancheResult ? formatCurrency(avalancheResult.total_interest_cents) : '$0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Using avalanche method
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        {hasDebts && avalancheResult && (
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Debt Breakdown
                </CardTitle>
                <CardDescription>
                  Distribution of your current debts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DebtBreakdownChart debts={debts} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Payoff Timeline
                </CardTitle>
                <CardDescription>
                  Your projected debt reduction over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DebtPayoffChart schedule={avalancheResult.schedule} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payment History & Analytics */}
        {hasDebts && <AnalyticsSection />}

        {/* Progress or Getting Started */}
        {hasDebts && avalancheResult ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Payoff Progress</CardTitle>
              <CardDescription>
                Your journey to becoming debt-free
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {avalancheResult.debts_payoff_order.slice(0, 3).map((debt, index) => {
                  const debtData = debts.find(d => d.id === debt.id);
                  const scheduleMonth = avalancheResult.schedule[debt.payoff_month - 1];
                  const startBalance = debts.find(d => d.id === debt.id)?.balance_cents ?? 0;

                  return (
                    <div key={debt.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                            {index + 1}
                          </span>
                          <span className="font-medium">{debt.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Payoff: {formatDate(scheduleMonth?.date ?? new Date())}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={0} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-24 text-right">
                          {formatCurrency(debtData?.balance_cents ?? 0)} left
                        </span>
                      </div>
                    </div>
                  );
                })}

                {avalancheResult.debts_payoff_order.length > 3 && (
                  <p className="text-center text-sm text-muted-foreground">
                    + {avalancheResult.debts_payoff_order.length - 3} more debts
                  </p>
                )}

                <div className="pt-4">
                  <Button asChild className="w-full">
                    <Link href="/plan">
                      View Full Plan <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>
                Follow these steps to create your debt payoff plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${hasDebts ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'} text-sm font-medium`}>
                    {hasDebts ? <CheckCircle2 className="h-5 w-5" /> : '1'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Add your debts</p>
                    <p className="text-sm text-muted-foreground">
                      Enter your credit cards, loans, and other debts
                    </p>
                  </div>
                  <Button asChild variant={hasDebts ? 'outline' : 'default'}>
                    <Link href="/debts">
                      {hasDebts ? 'Manage' : 'Add'} Debts <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${hasDebts ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} text-sm font-medium`}>
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Create your payoff plan</p>
                    <p className="text-sm text-muted-foreground">
                      Choose snowball or avalanche strategy
                    </p>
                  </div>
                  <Button variant="outline" asChild disabled={!hasDebts}>
                    <Link href="/plan">
                      View Plan <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Start a detox sprint (optional)</p>
                    <p className="text-sm text-muted-foreground">
                      Accelerate your payoff with a spending freeze
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/detox">
                      Start Sprint <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
