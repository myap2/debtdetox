'use client';

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

const debtTypes: { value: DebtType; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'student_loan', label: 'Student Loan' },
  { value: 'auto', label: 'Auto Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'medical', label: 'Medical Debt' },
  { value: 'other', label: 'Other' },
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
