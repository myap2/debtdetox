'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash, Receipt, CalendarDays, TrendingUp } from 'lucide-react';
import { PaymentDialog } from './payment-dialog';
import { usePayments, PAYMENT_RELATED_KEYS } from '@/hooks/use-payments';
import { useUndoableDelete } from '@/hooks/use-undoable-delete';
import { calculatePaymentStats } from '@/lib/analytics';
import { formatCurrency, formatFullDate } from '@/lib/format';
import type { Debt, Payment } from '@/types/database';

interface PaymentHistoryProps {
  debt: Debt;
}

async function deletePaymentRequest(payment: Payment) {
  const response = await fetch(`/api/payments/${payment.id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete payment');
  }
}

export function PaymentHistory({ debt }: PaymentHistoryProps) {
  const { data: payments = [], isLoading } = usePayments(debt.id);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const { deleteWithUndo } = useUndoableDelete<Payment>({
    queryKey: ['payments', debt.id],
    getId: (payment) => payment.id,
    deleteFn: deletePaymentRequest,
    invalidateKeys: PAYMENT_RELATED_KEYS.map((key) => [...key]),
    entityLabel: 'payment',
  });

  const stats = useMemo(() => calculatePaymentStats(payments), [payments]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payment Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_paid_cents)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.payment_count} payment{stats.payment_count === 1 ? '' : 's'} recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Payment</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.last_payment_date ? formatFullDate(stats.last_payment_date) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.last_payment_date ? 'Most recent payment date' : 'No payments yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Monthly Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.average_monthly_payment_cents)}
            </div>
            <p className="text-xs text-muted-foreground">Since your first payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Table */}
      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No payments recorded yet. Click &quot;Record Payment&quot; to log your first payment.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {formatFullDate(payment.paid_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(payment.amount_cents)}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground">
                    {payment.note ?? '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Payment actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingPayment(payment)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            deleteWithUndo(payment, {
                              description: `${formatCurrency(payment.amount_cents)} will be restored to the balance`,
                            })
                          }
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaymentDialog
        open={!!editingPayment}
        onOpenChange={(open) => !open && setEditingPayment(null)}
        debt={debt}
        payment={editingPayment}
        onSuccess={() => setEditingPayment(null)}
      />
    </div>
  );
}
