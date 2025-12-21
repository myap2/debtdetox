'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DebtDialog } from '@/components/debts/debt-dialog';
import { DebtList } from '@/components/debts/debt-list';

export default function DebtsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <Header
        title="Debts"
        description="Manage your debts and track balances"
      />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your Debts</h2>
            <p className="text-sm text-muted-foreground">
              Add all your debts to create an accurate payoff plan
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Debt
          </Button>
        </div>

        <DebtList />

        <DebtDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>
    </div>
  );
}
