'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash, DollarSign, History } from 'lucide-react';
import { DebtDialog } from './debt-dialog';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { toast } from 'sonner';
import { useDebts } from '@/hooks/use-debts';
import { useUndoableDelete } from '@/hooks/use-undoable-delete';
import { formatCurrency, formatPercent } from '@/lib/format';
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

async function deleteDebtRequest(debt: Debt) {
  const response = await fetch(`/api/debts/${debt.id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete debt');
  }
}

export function DebtList() {
  const { data: debts = [], isLoading, error } = useDebts();
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);

  const { deleteWithUndo } = useUndoableDelete<Debt>({
    queryKey: ['debts'],
    getId: (debt) => debt.id,
    deleteFn: deleteDebtRequest,
    invalidateKeys: [['payoffPlan'], ['payments'], ['analytics'], ['activity']],
    entityLabel: 'debt',
  });

  if (error) {
    toast.error('Failed to load debts');
  }

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
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
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">APR</TableHead>
              <TableHead className="text-right">Min Payment</TableHead>
              <TableHead className="text-right">Due Day</TableHead>
              <TableHead className="w-[110px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.map((debt) => (
              <TableRow key={debt.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/debts/${debt.id}`}
                    className="hover:underline focus-visible:underline"
                  >
                    {debt.name}
                  </Link>
                </TableCell>
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
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPayingDebt(debt)}
                      aria-label={`Record payment for ${debt.name}`}
                      title="Record payment"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${debt.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPayingDebt(debt)}>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Record Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/debts/${debt.id}`}>
                            <History className="mr-2 h-4 w-4" />
                            Payment History
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingDebt(debt)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            deleteWithUndo(debt, {
                              description: `${debt.name} and its payment history will be removed`,
                            })
                          }
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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

      <PaymentDialog
        open={!!payingDebt}
        onOpenChange={(open) => !open && setPayingDebt(null)}
        debt={payingDebt}
        onSuccess={() => setPayingDebt(null)}
      />
    </>
  );
}
