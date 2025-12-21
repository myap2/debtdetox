'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Scale, TrendingUp, CreditCard, Info, RefreshCw } from 'lucide-react';
import { DebtVsInvestChart } from '@/components/charts/debt-vs-invest-chart';
import { useDebtVsInvest } from '@/hooks/use-debt-vs-invest';
import { useDebts } from '@/hooks/use-debts';
import Link from 'next/link';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function DebtVsInvestComparison() {
  const [extraAmounts, setExtraAmounts] = useState(['100', '250', '500']);
  const [investmentReturn, setInvestmentReturn] = useState('7');
  const [years, setYears] = useState('10');

  const { data: debts, isLoading: debtsLoading } = useDebts();

  const compareOptions = debts && debts.length > 0 ? {
    extra_amounts_cents: extraAmounts.map((a) => Math.round(parseFloat(a || '0') * 100)),
    investment_return_bps: Math.round(parseFloat(investmentReturn || '7') * 100),
    years: parseInt(years || '10', 10),
  } : null;

  const { data: comparison, isLoading, error, refetch } = useDebtVsInvest(compareOptions);

  if (debtsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!debts || debts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Add debts first to compare strategies</p>
          <Button variant="link" asChild>
            <Link href="/debts">Add your debts</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Debt vs. Invest Comparison
          </CardTitle>
          <CardDescription>
            Should you pay off debt faster or invest the extra money?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Inputs */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Extra Amounts to Compare ($)</Label>
              <div className="flex gap-2">
                {extraAmounts.map((amount, i) => (
                  <Input
                    key={i}
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => {
                      const newAmounts = [...extraAmounts];
                      newAmounts[i] = e.target.value;
                      setExtraAmounts(newAmounts);
                    }}
                    className="w-20"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invReturn">Expected Investment Return</Label>
              <div className="relative">
                <Input
                  id="invReturn"
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={investmentReturn}
                  onChange={(e) => setInvestmentReturn(e.target.value)}
                  className="pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compYears">Comparison Period</Label>
              <div className="relative">
                <Input
                  id="compYears"
                  type="number"
                  min="1"
                  max="30"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  years
                </span>
              </div>
            </div>

            <div className="flex items-end">
              <Button onClick={() => refetch()} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Compare
              </Button>
            </div>
          </div>

          {/* Current Debt Summary */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Your Current Debts</h4>
            <div className="flex flex-wrap gap-2">
              {debts.map((debt) => (
                <Badge key={debt.id} variant="secondary">
                  {debt.name}: {formatCurrency(debt.balance_cents)} @ {(debt.apr_bps / 100).toFixed(1)}%
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {comparison && (
        <>
          {/* Recommendation */}
          <Alert className={
            comparison.summary.recommendation === 'invest'
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
              : comparison.summary.recommendation === 'pay_debt'
                ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
          }>
            <Info className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Recommendation:{' '}
              <Badge variant={
                comparison.summary.recommendation === 'invest' ? 'default' :
                comparison.summary.recommendation === 'pay_debt' ? 'destructive' : 'secondary'
              }>
                {comparison.summary.recommendation === 'invest' ? 'Invest' :
                 comparison.summary.recommendation === 'pay_debt' ? 'Pay Debt' : 'Split 50/50'}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              {comparison.summary.reasoning}
            </AlertDescription>
          </Alert>

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Weighted Debt APR</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {(comparison.summary.weighted_debt_apr_bps / 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Average cost of your debt</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Expected Investment Return</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {(comparison.summary.expected_investment_return_bps / 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Your projected growth rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Breakeven Return</CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(comparison.breakeven_return_bps / 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Return needed to match debt payoff
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Scenario Comparison</CardTitle>
              <CardDescription>
                See how different extra payment amounts compare between strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DebtVsInvestChart scenarios={comparison.scenarios} />
            </CardContent>
          </Card>

          {/* Detailed Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comparison.scenarios.map((scenario, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">
                        Extra {formatCurrency(scenario.extra_payment_cents)}/month
                      </h4>
                      <Badge variant={scenario.recommended === 'invest' ? 'default' : 'destructive'}>
                        {scenario.recommended === 'invest' ? 'Invest' : 'Pay Debt'}
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">If paying debt:</p>
                        <p className="font-medium">
                          Save {formatCurrency(scenario.debt_interest_saved_cents)} in interest
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Pay off {scenario.months_saved_on_debt} months faster
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">If investing:</p>
                        <p className="font-medium">
                          Grow {formatCurrency(scenario.investment_growth_cents)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Final balance: {formatCurrency(scenario.investment_final_balance_cents)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm mt-2 text-muted-foreground">{scenario.reasoning}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
