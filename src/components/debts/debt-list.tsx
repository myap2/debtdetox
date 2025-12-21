'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { DebtDialog } from './debt-dialog';
import { toast } from 'sonner';
import { useDebts, useDeleteDebt } from '@/hooks/use-debts';
import type { Debt, DebtType } from '@/types/database';

const debtTypeLabels: Record<DebtType, string> = {
  credit_card: 'Credit Card',
  student_loan: 'Student Loan',
  mortgage: 'Mortgage',
  auto: 'Auto Loan',
  personal: 'Personal Loan',
  medical: 'Medical',
  other: 'Other',
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function DebtList() {
  const { data: debts = [], isLoading, error } = useDebts();
  const deleteDebt = useDeleteDebt();
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this debt?')) return;

    try {
      await deleteDebt.mutateAsync(id);
      toast.success('Debt deleted');
    } catch {
      toast.error('Failed to delete debt');
    }
  }

  if (error) {
    toast.error('Failed to load debts');
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Loading debts...
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No debts added yet. Click &quot;Add Debt&quot; to get started.
      </div>
    );
  }

  const totalBalance = debts.reduce((sum, d) => sum + d.balance_cents, 0);
  const totalMinPayment = debts.reduce((sum, d) => sum + d.min_payment_cents, 0);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">APR</TableHead>
              <TableHead className="text-right">Min Payment</TableHead>
              <TableHead className="text-right">Due Day</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.map((debt) => (
              <TableRow key={debt.id}>
                <TableCell className="font-medium">{debt.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {debtTypeLabels[debt.type as DebtType]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(debt.balance_cents)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(debt.apr_bps)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(debt.min_payment_cents)}
                </TableCell>
                <TableCell className="text-right">
                  {debt.due_day ?? '-'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingDebt(debt)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(debt.id)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right">
                {formatCurrency(totalBalance)}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right">
                {formatCurrency(totalMinPayment)}
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <DebtDialog
        open={!!editingDebt}
        onOpenChange={(open) => !open && setEditingDebt(null)}
        debt={editingDebt}
        onSuccess={() => setEditingDebt(null)}
      />
    </>
  );
}
