'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, DollarSign, Pencil } from 'lucide-react';
import { DebtDialog } from '@/components/debts/debt-dialog';
import { PaymentDialog } from '@/components/payments/payment-dialog';
import { PaymentHistory } from '@/components/payments/payment-history';
import { useDebt } from '@/hooks/use-debts';
import { usePayments } from '@/hooks/use-payments';
import { formatCurrency, formatPercent } from '@/lib/format';
import type { DebtType } from '@/types/database';

const debtTypeLabels: Record<DebtType, string> = {
  credit_card: 'Credit Card',
  student_loan: 'Student Loan',
  mortgage: 'Mortgage',
  auto: 'Auto Loan',
  personal: 'Personal Loan',
  medical: 'Medical',
  other: 'Other',
};

export default function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: debt, isLoading, error } = useDebt(id);
  const { data: payments = [] } = usePayments(id);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [editingDebt, setEditingDebt] = useState(false);

  // Progress toward payoff: what payments have knocked off the balance so far
  const totalPaidDown = useMemo(
    () => payments.reduce((sum, p) => sum + p.balance_delta_cents, 0),
    [payments]
  );
  const originalBalance = (debt?.balance_cents ?? 0) + totalPaidDown;
  const progress = originalBalance > 0 ? (totalPaidDown / originalBalance) * 100 : 0;

  if (error) {
    return (
      <div className="flex flex-col">
        <Header title="Debt" description="Debt details and payment history" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">This debt could not be found.</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/debts">Back to debts</Link>
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
        title={debt?.name ?? 'Debt'}
        description="Debt details and payment history"
      />

      <div className="flex-1 space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" asChild className="w-fit -ml-2">
            <Link href="/debts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Debts
            </Link>
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingDebt(true)} disabled={!debt}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Debt
            </Button>
            <Button onClick={() => setRecordingPayment(true)} disabled={!debt}>
              <DollarSign className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </div>
        </div>

        {/* Debt Summary */}
        {isLoading || !debt ? (
          <Skeleton className="h-40" />
        ) : (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{debt.name}</h2>
                    <Badge variant="secondary">{debtTypeLabels[debt.type]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatPercent(debt.apr_bps)} APR · {formatCurrency(debt.min_payment_cents)}{' '}
                    minimum{debt.due_day ? ` · due on day ${debt.due_day}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{formatCurrency(debt.balance_cents)}</div>
                  <p className="text-sm text-muted-foreground">remaining balance</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payoff progress</span>
                  <span className="font-medium">{progress.toFixed(0)}%</span>
                </div>
                <Progress
                  value={progress}
                  className="h-2"
                  aria-label={`${progress.toFixed(0)}% of this debt paid off`}
                />
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalPaidDown)} paid down of{' '}
                  {formatCurrency(originalBalance)} tracked
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment History */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Payment History</h2>
          {debt && <PaymentHistory debt={debt} />}
        </div>
      </div>

      {debt && (
        <>
          <PaymentDialog
            open={recordingPayment}
            onOpenChange={setRecordingPayment}
            debt={debt}
          />
          <DebtDialog
            open={editingDebt}
            onOpenChange={setEditingDebt}
            debt={editingDebt ? debt : null}
          />
        </>
      )}
    </div>
  );
}
