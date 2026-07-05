'use client';

import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useCreateInvestment, useUpdateInvestment } from '@/hooks/use-investments';
import type { Investment, InvestmentType, TaxStatus } from '@/types/database';

const investmentTypes: { value: InvestmentType; label: string }[] = [
  { value: 'stocks', label: 'Stocks' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'retirement_401k', label: '401(k)' },
  { value: 'retirement_ira', label: 'IRA' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'savings', label: 'Savings' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'custom', label: 'Custom' },
];

interface ProfileFormData {
  name: string;
  type: InvestmentType;
  initialBalance: string;
  monthlyContribution: string;
  annualReturn: string;
  taxStatus: TaxStatus;
  taxRate: string;
  inflationRate: string;
  targetYears: string;
}

interface InvestmentProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this profile instead of creating a new one. */
  profile?: Investment | null;
  onSuccess?: () => void;
}

export function InvestmentProfileDialog({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: InvestmentProfileDialogProps) {
  const createInvestment = useCreateInvestment();
  const updateInvestment = useUpdateInvestment();
  const isSubmitting = createInvestment.isPending || updateInvestment.isPending;
  const isEditing = !!profile;

  const form = useForm<ProfileFormData>({
    values: {
      name: profile?.name ?? '',
      type: profile?.type ?? 'custom',
      initialBalance: profile ? (profile.initial_balance_cents / 100).toString() : '10000',
      monthlyContribution: profile
        ? (profile.monthly_contribution_cents / 100).toString()
        : '500',
      annualReturn: profile ? (profile.annual_return_bps / 100).toString() : '7',
      taxStatus: profile?.tax_status ?? 'taxable',
      taxRate: profile ? (profile.tax_rate_bps / 100).toString() : '25',
      inflationRate: profile ? (profile.inflation_rate_bps / 100).toString() : '3',
      targetYears: profile?.target_years?.toString() ?? '10',
    },
  });

  async function onSubmit(data: ProfileFormData) {
    if (!data.name.trim()) {
      form.setError('name', { message: 'Name is required' });
      return;
    }

    const initialBalance = parseFloat(data.initialBalance);
    if (isNaN(initialBalance) || initialBalance < 0) {
      form.setError('initialBalance', { message: 'Valid starting amount is required' });
      return;
    }

    const monthlyContribution = parseFloat(data.monthlyContribution);
    if (isNaN(monthlyContribution) || monthlyContribution < 0) {
      form.setError('monthlyContribution', { message: 'Valid contribution is required' });
      return;
    }

    const annualReturn = parseFloat(data.annualReturn);
    if (isNaN(annualReturn)) {
      form.setError('annualReturn', { message: 'Valid return is required' });
      return;
    }

    const taxRate = parseFloat(data.taxRate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      form.setError('taxRate', { message: 'Tax rate must be between 0 and 100' });
      return;
    }

    const inflationRate = parseFloat(data.inflationRate);
    if (isNaN(inflationRate) || inflationRate < 0) {
      form.setError('inflationRate', { message: 'Valid inflation rate is required' });
      return;
    }

    const targetYears = parseInt(data.targetYears, 10);
    if (isNaN(targetYears) || targetYears < 1 || targetYears > 100) {
      form.setError('targetYears', { message: 'Time horizon must be 1-100 years' });
      return;
    }

    const payload = {
      name: data.name.trim(),
      type: data.type,
      initial_balance_cents: Math.round(initialBalance * 100),
      monthly_contribution_cents: Math.round(monthlyContribution * 100),
      annual_return_bps: Math.round(annualReturn * 100),
      tax_status: data.taxStatus,
      tax_rate_bps: Math.round(taxRate * 100),
      inflation_rate_bps: Math.round(inflationRate * 100),
      target_years: targetYears,
    };

    try {
      if (profile) {
        await updateInvestment.mutateAsync({ id: profile.id, investment: payload });
        toast.success('Profile updated');
      } else {
        await createInvestment.mutateAsync(payload);
        toast.success('Profile created');
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Profile' : 'New Investment Profile'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this saved investment scenario.'
              : 'Save an investment scenario you can reload into the calculator anytime.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Aggressive 401k" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {investmentTypes.map((type) => (
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="initialBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input type="number" step="0.01" min="0" className="pl-7" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyContribution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Contribution</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input type="number" step="0.01" min="0" className="pl-7" {...field} />
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
                name="annualReturn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Return (%)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.1"
                          min="-100"
                          max="100"
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

              <FormField
                control={form.control}
                name="targetYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Horizon (years)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="taxStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="taxable">Taxable</SelectItem>
                        <SelectItem value="tax_deferred">Tax-Deferred</SelectItem>
                        <SelectItem value="tax_free">Tax-Free</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" max="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inflationRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inflation (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" max="20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Profile' : 'Create Profile'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
