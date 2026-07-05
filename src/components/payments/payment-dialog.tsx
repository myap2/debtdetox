'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PaymentForm } from './payment-form';
import { formatCurrency } from '@/lib/format';
import type { Debt, Payment } from '@/types/database';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: Debt | null;
  /** When set, the dialog edits this payment instead of recording a new one. */
  payment?: Payment | null;
  onSuccess?: () => void;
}

export function PaymentDialog({ open, onOpenChange, debt, payment, onSuccess }: PaymentDialogProps) {
  const isEditing = !!payment;

  function handleSuccess() {
    onOpenChange(false);
    onSuccess?.();
  }

  if (!debt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Payment' : 'Record Payment'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update this payment on ${debt.name}. The balance is recalculated automatically.`
              : `Log a payment toward ${debt.name} (${formatCurrency(debt.balance_cents)} remaining).`}
          </DialogDescription>
        </DialogHeader>
        <PaymentForm
          debt={debt}
          payment={payment}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
