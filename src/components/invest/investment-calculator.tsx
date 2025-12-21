'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calculator, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { InvestmentGrowthChart } from '@/components/charts/investment-growth-chart';
import { useQuickProjection } from '@/hooks/use-investment-projection';
import type { TaxStatus } from '@/lib/investment-engine';
import { INVESTMENT_DEFAULTS } from '@/lib/investment-engine';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function InvestmentCalculator() {
  const [initialBalance, setInitialBalance] = useState('10000');
  const [monthlyContribution, setMonthlyContribution] = useState('500');
  const [annualReturn, setAnnualReturn] = useState('7');
  const [years, setYears] = useState('10');
  const [taxStatus, setTaxStatus] = useState<TaxStatus>('taxable');
  const [taxRate, setTaxRate] = useState('25');
  const [inflationRate, setInflationRate] = useState('3');
  const [showInflation, setShowInflation] = useState(true);
  const [showTaxes, setShowTaxes] = useState(true);

  const investment = {
    initial_balance_cents: Math.round(parseFloat(initialBalance || '0') * 100),
    monthly_contribution_cents: Math.round(parseFloat(monthlyContribution || '0') * 100),
    annual_return_bps: Math.round(parseFloat(annualReturn || '0') * 100),
    tax_status: taxStatus,
    tax_rate_bps: Math.round(parseFloat(taxRate || '0') * 100),
    inflation_rate_bps: Math.round(parseFloat(inflationRate || '0') * 100),
  };

  const options = {
    years: parseInt(years || '10', 10),
    include_inflation: showInflation,
    include_taxes: showTaxes,
  };

  const { data: projection, isLoading } = useQuickProjection(
    investment.initial_balance_cents >= 0 ? investment : null,
    options
  );

  function applyPreset(type: keyof typeof INVESTMENT_DEFAULTS) {
    const preset = INVESTMENT_DEFAULTS[type];
    setAnnualReturn((preset.annual_return_bps / 100).toString());
    setTaxStatus(preset.tax_status);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Investment Calculator
          </CardTitle>
          <CardDescription>
            Project your investment growth with compound interest
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Investment Inputs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="initial">Initial Investment</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="initial"
                  type="number"
                  min="0"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly">Monthly Contribution</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="monthly"
                  type="number"
                  min="0"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="return">Annual Return</Label>
              <div className="relative">
                <Input
                  id="return"
                  type="number"
                  min="-100"
                  max="100"
                  step="0.5"
                  value={annualReturn}
                  onChange={(e) => setAnnualReturn(e.target.value)}
                  className="pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="years">Time Horizon</Label>
              <div className="relative">
                <Input
                  id="years"
                  type="number"
                  min="1"
                  max="50"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  years
                </span>
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <Label>Investment Type (Presets)</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => applyPreset('stocks')}>
                Stocks (10%)
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('bonds')}>
                Bonds (5%)
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('retirement_401k')}>
                401(k) (7%)
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('savings')}>
                Savings (4.5%)
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('crypto')}>
                Crypto (15%)
              </Button>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="taxStatus">Tax Status</Label>
              <Select value={taxStatus} onValueChange={(v) => setTaxStatus(v as TaxStatus)}>
                <SelectTrigger id="taxStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxable">Taxable (Brokerage)</SelectItem>
                  <SelectItem value="tax_deferred">Tax-Deferred (401k/IRA)</SelectItem>
                  <SelectItem value="tax_free">Tax-Free (Roth)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate</Label>
              <div className="relative">
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inflation">Inflation Rate</Label>
              <div className="relative">
                <Input
                  id="inflation"
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={inflationRate}
                  onChange={(e) => setInflationRate(e.target.value)}
                  className="pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="showInflation"
                checked={showInflation}
                onCheckedChange={setShowInflation}
              />
              <Label htmlFor="showInflation">Show inflation-adjusted values</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="showTaxes" checked={showTaxes} onCheckedChange={setShowTaxes} />
              <Label htmlFor="showTaxes">Include tax impact</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {projection && 'schedule' in projection && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Final Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(projection.final_balance_cents)}
                </div>
                {showInflation && (
                  <p className="text-xs text-muted-foreground">
                    Real value: {formatCurrency(projection.final_real_balance_cents)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Contributed</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(projection.total_contributions_cents)}
                </div>
                <p className="text-xs text-muted-foreground">Your principal investment</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Growth</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(projection.total_interest_cents)}
                </div>
                <p className="text-xs text-muted-foreground">From compound interest</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">After-Tax Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(projection.after_tax_balance_cents)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tax: {formatCurrency(projection.tax_impact_cents)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Growth Projection</CardTitle>
              <CardDescription>
                Your investment growth over {years} years
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex h-[300px] items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <InvestmentGrowthChart
                  schedule={projection.schedule}
                  showContributions={true}
                  showRealBalance={showInflation}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
