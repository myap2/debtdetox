'use client';

import { Header } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvestmentCalculator } from '@/components/invest/investment-calculator';
import { DebtVsInvestComparison } from '@/components/invest/debt-vs-invest-comparison';

export default function InvestPage() {
  return (
    <div className="flex flex-col">
      <Header
        title="Investment Calculator"
        description="Project your investment growth and compare strategies"
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue="calculator" className="space-y-6">
          <TabsList>
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="compare">Debt vs. Invest</TabsTrigger>
          </TabsList>

          <TabsContent value="calculator">
            <InvestmentCalculator />
          </TabsContent>

          <TabsContent value="compare">
            <DebtVsInvestComparison />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
