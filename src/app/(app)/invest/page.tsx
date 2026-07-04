'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { InvestmentCalculator } from '@/components/invest/investment-calculator';
import { DebtVsInvestComparison } from '@/components/invest/debt-vs-invest-comparison';
import { InvestmentProfiles } from '@/components/invest/investment-profiles';
import type { Investment } from '@/types/database';

export default function InvestPage() {
  const [tab, setTab] = useState('calculator');
  const [loadedProfile, setLoadedProfile] = useState<Investment | null>(null);

  function handleLoadProfile(profile: Investment) {
    setLoadedProfile(profile);
    setTab('calculator');
    toast.success(`Loaded "${profile.name}" into the calculator`);
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Investment Calculator"
        description="Project your investment growth and compare strategies"
      />

      <div className="flex-1 p-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="compare">Debt vs. Invest</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
          </TabsList>

          <TabsContent value="calculator">
            {/* Remount when a different profile loads so its values seed the inputs */}
            <InvestmentCalculator
              key={loadedProfile?.id ?? 'default'}
              profile={loadedProfile}
              onProfileSaved={setLoadedProfile}
              onClearProfile={() => setLoadedProfile(null)}
            />
          </TabsContent>

          <TabsContent value="compare">
            <DebtVsInvestComparison />
          </TabsContent>

          <TabsContent value="profiles">
            <InvestmentProfiles onLoad={handleLoadProfile} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
