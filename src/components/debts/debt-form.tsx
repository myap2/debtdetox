'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { useCreateDebt, useUpdateDebt } from '@/hooks/use-debts';
import type { Debt, DebtType } from '@/types/database';

const debtTypes: { value: DebtType; label: string; defaultApr: number; minPaymentPercent: number }[] = [
  { value: 'credit_card', label: 'Credit Card', defaultApr: 22.99, minPaymentPercent: 2 },
  { value: 'student_loan', label: 'Student Loan', defaultApr: 6.5, minPaymentPercent: 1 },
  { value: 'auto', label: 'Auto Loan', defaultApr: 7.0, minPaymentPercent: 2.5 },
  { value: 'mortgage', label: 'Mortgage', defaultApr: 6.5, minPaymentPercent: 0.5 },
  { value: 'personal', label: 'Personal Loan', defaultApr: 12.0, minPaymentPercent: 3 },
  { value: 'medical', label: 'Medical Debt', defaultApr: 0, minPaymentPercent: 5 },
  { value: 'other', label: 'Other', defaultApr: 10.0, minPaymentPercent: 2 },
];

interface DebtFormData {
  name: string;
  type: DebtType;
  balance: string;
  apr: string;
  minPayment: string;
  dueDay: string;
}

interface DebtFormProps {
  debt?: Debt | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DebtForm({ debt, onSuccess, onCancel }: DebtFormProps) {
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const isSubmitting = createDebt.isPending || updateDebt.isPending;
  const isEditing = !!debt;

  const form = useForm<DebtFormData>({
    defaultValues: {
      name: debt?.name ?? '',
      type: debt?.type ?? 'credit_card',
      balance: debt ? (debt.balance_cents / 100).toString() : '',
      apr: debt ? (debt.apr_bps / 100).toString() : '',
      minPayment: debt ? (debt.min_payment_cents / 100).toString() : '',
      dueDay: debt?.due_day?.toString() ?? '',
    },
  });

  const watchType = form.watch('type');
  const watchBalance = form.watch('balance');

  // Set default APR on initial load for new debts
  useEffect(() => {
    if (!isEditing) {
      const typeConfig = debtTypes.find(t => t.value === 'credit_card');
      if (typeConfig && !form.getValues('apr')) {
        form.setValue('apr', typeConfig.defaultApr.toString());
      }
    }
  }, [isEditing, form]);

  // Auto-fill APR when type changes (only for new debts, and only if APR is empty or was auto-filled)
  function handleTypeChange(newType: DebtType) {
    form.setValue('type', newType);

    if (!isEditing) {
      const typeConfig = debtTypes.find(t => t.value === newType);
      if (typeConfig) {
        // Always set default APR when type changes for new debts
        form.setValue('apr', typeConfig.defaultApr.toString());

        // Recalculate min payment if balance exists
        const balance = parseFloat(watchBalance);
        if (!isNaN(balance) && balance > 0) {
          const minPayment = Math.max(25, balance * (typeConfig.minPaymentPercent / 100));
          form.setValue('minPayment', minPayment.toFixed(2));
        }
      }
    }
  }

  // Auto-calculate minimum payment when balance changes (only for new debts)
  function handleBalanceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    form.setValue('balance', value);

    if (!isEditing) {
      const balance = parseFloat(value);
      const typeConfig = debtTypes.find(t => t.value === watchType);

      if (!isNaN(balance) && balance > 0 && typeConfig) {
        // Calculate minimum payment (at least $25 for most debts)
        const minPayment = Math.max(25, balance * (typeConfig.minPaymentPercent / 100));
        form.setValue('minPayment', minPayment.toFixed(2));
      }
    }
  }

  async function onSubmit(data: DebtFormData) {
    // Validate
    if (!data.name.trim()) {
      form.setError('name', { message: 'Name is required' });
      return;
    }

    const balance = parseFloat(data.balance);
    if (isNaN(balance) || balance < 0) {
      form.setError('balance', { message: 'Valid balance is required' });
      return;
    }

    const apr = parseFloat(data.apr);
    if (isNaN(apr) || apr < 0) {
      form.setError('apr', { message: 'Valid APR is required' });
      return;
    }

    const minPayment = parseFloat(data.minPayment);
    if (isNaN(minPayment) || minPayment < 0) {
      form.setError('minPayment', { message: 'Valid minimum payment is required' });
      return;
    }

    const dueDay = data.dueDay ? parseInt(data.dueDay, 10) : null;
    if (dueDay !== null && (isNaN(dueDay) || dueDay < 1 || dueDay > 31)) {
      form.setError('dueDay', { message: 'Due day must be between 1 and 31' });
      return;
    }

    const payload = {
      name: data.name.trim(),
      type: data.type,
      balance_cents: Math.round(balance * 100),
      apr_bps: Math.round(apr * 100),
      min_payment_cents: Math.round(minPayment * 100),
      due_day: dueDay,
    };

    try {
      if (debt) {
        await updateDebt.mutateAsync({ id: debt.id, debt: payload });
        toast.success('Debt updated!');
      } else {
        await createDebt.mutateAsync(payload);
        toast.success('Debt added!');
      }
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Chase Sapphire" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={(value) => handleTypeChange(value as DebtType)} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select debt type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {debtTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="balance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Balance</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-7"
                      {...field}
                      onChange={handleBalanceChange}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>APR (%)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      className="pr-7"
                      {...field}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      %
                    </span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="minPayment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Payment</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-7"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Day (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="1-31"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : debt ? 'Update Debt' : 'Add Debt'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
