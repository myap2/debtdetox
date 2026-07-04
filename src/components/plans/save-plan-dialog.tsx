'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSavePlan } from '@/hooks/use-saved-plans';
import { formatCurrency } from '@/lib/format';
import type { PayoffStrategy } from '@/lib/payoff-engine';

interface SavePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: PayoffStrategy;
  extraPaymentCents: number;
}

export function SavePlanDialog({
  open,
  onOpenChange,
  strategy,
  extraPaymentCents,
}: SavePlanDialogProps) {
  const savePlan = useSavePlan();
  const router = useRouter();

  const strategyLabel = strategy === 'avalanche' ? 'Avalanche' : 'Snowball';
  const defaultName = extraPaymentCents > 0
    ? `${strategyLabel} + ${formatCurrency(extraPaymentCents, { compact: true })}/mo`
    : strategyLabel;
  const [name, setName] = useState(defaultName);

  // Re-seed the name each time the dialog opens; the strategy/extra payment
  // may have changed since the last open (and Radix doesn't call onOpenChange
  // for programmatic open changes).
  useEffect(() => {
    if (open) setName(defaultName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    try {
      const plan = await savePlan.mutateAsync({
        name: name.trim(),
        strategy,
        extra_payment_cents: extraPaymentCents,
      });
      onOpenChange(false);
      toast.success('Plan saved', {
        action: {
          label: 'View',
          onClick: () => router.push(`/plans/${plan.id}`),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save plan');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Plan</DialogTitle>
          <DialogDescription>
            Saves the {strategyLabel.toLowerCase()} strategy
            {extraPaymentCents > 0
              ? ` with ${formatCurrency(extraPaymentCents)} extra per month`
              : ''}{' '}
            and a snapshot of your current debts, so you can come back to it later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan Name</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savePlan.isPending}>
              {savePlan.isPending ? 'Saving...' : 'Save Plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
