'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DebtForm } from './debt-form';
import type { Debt } from '@/types/database';

interface DebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt | null;
  onSuccess?: () => void;
}

export function DebtDialog({ open, onOpenChange, debt, onSuccess }: DebtDialogProps) {
  const isEditing = !!debt;

  function handleSuccess() {
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Debt' : 'Add New Debt'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the details of your debt.'
              : 'Enter the details of your debt to add it to your plan.'}
          </DialogDescription>
        </DialogHeader>
        <DebtForm debt={debt} onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
