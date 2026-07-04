'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  OverpaymentError,
  useCreatePayment,
  useUpdatePayment,
} from '@/hooks/use-payments';
import { formatCurrency, todayISODate } from '@/lib/format';
import type { Debt, Payment } from '@/types/database';

interface PaymentFormData {
  amount: string;
  paidAt: string;
  note: string;
}

interface PaymentFormProps {
  debt: Debt;
  /** When set, the form edits this payment instead of recording a new one. */
  payment?: Payment | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentForm({ debt, payment, onSuccess, onCancel }: PaymentFormProps) {
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const isSubmitting = createPayment.isPending || updatePayment.isPending;
  const isEditing = !!payment;

  // Set when the server rejects the amount as larger than the remaining
  // balance; the user can then resubmit with an explicit confirmation.
  const [overpayment, setOverpayment] = useState<{ remainingCents: number } | null>(null);

  const form = useForm<PaymentFormData>({
    defaultValues: {
      amount: payment ? (payment.amount_cents / 100).toString() : '',
      paidAt: payment?.paid_at ?? todayISODate(),
      note: payment?.note ?? '',
    },
  });

  async function onSubmit(data: PaymentFormData) {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      form.setError('amount', { message: 'Payment must be greater than zero' });
      return;
    }

    if (!data.paidAt) {
      form.setError('paidAt', { message: 'Payment date is required' });
      return;
    }

    const payload = {
      amount_cents: Math.round(amount * 100),
      paid_at: data.paidAt,
      note: data.note.trim() || null,
      allow_overpayment: !!overpayment,
    };

    try {
      if (payment) {
        await updatePayment.mutateAsync({ id: payment.id, payment: payload });
        toast.success('Payment updated');
      } else {
        await createPayment.mutateAsync({ debt_id: debt.id, ...payload });
        toast.success('Payment recorded');
      }
      onSuccess?.();
    } catch (error) {
      if (error instanceof OverpaymentError) {
        setOverpayment({ remainingCents: error.remainingBalanceCents });
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <Form {...form}>
      {/* noValidate: validation is handled below with user-friendly messages */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Amount</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    autoFocus
                    {...field}
                    onChange={(e) => {
                      setOverpayment(null);
                      field.onChange(e);
                    }}
                  />
                </div>
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Remaining balance: {formatCurrency(debt.balance_cents + (payment?.balance_delta_cents ?? 0))}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="paidAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Date</FormLabel>
              <FormControl>
                <Input type="date" max={todayISODate()} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., Extra payment from bonus"
                  maxLength={500}
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {overpayment && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Payment exceeds remaining balance</AlertTitle>
            <AlertDescription>
              This payment is more than the {formatCurrency(overpayment.remainingCents)}{' '}
              remaining on {debt.name}. The balance will be reduced to $0.00 and the full
              amount recorded. Submit again to confirm.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : overpayment
                ? 'Confirm Payment'
                : isEditing
                  ? 'Update Payment'
                  : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
