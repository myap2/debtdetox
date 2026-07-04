'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Payment } from '@/types/database';

// Thrown when the server rejects a payment larger than the remaining balance;
// the UI catches it to ask the user to confirm the overpayment.
export class OverpaymentError extends Error {
  remainingBalanceCents: number;

  constructor(remainingBalanceCents: number) {
    super('Payment exceeds remaining balance');
    this.name = 'OverpaymentError';
    this.remainingBalanceCents = remainingBalanceCents;
  }
}

async function throwPaymentError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null);
  if (body?.code === 'EXCEEDS_BALANCE') {
    throw new OverpaymentError(body.remaining_balance_cents ?? 0);
  }
  throw new Error(body?.error || fallback);
}

async function fetchPayments(debtId?: string): Promise<Payment[]> {
  const url = debtId ? `/api/payments?debt_id=${debtId}` : '/api/payments';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch payments');
  }
  return response.json();
}

export interface CreatePaymentInput {
  debt_id: string;
  amount_cents: number;
  paid_at: string;
  note?: string | null;
  allow_overpayment?: boolean;
}

async function createPayment(payment: CreatePaymentInput): Promise<Payment> {
  const response = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment),
  });
  if (!response.ok) {
    await throwPaymentError(response, 'Failed to record payment');
  }
  return response.json();
}

export interface UpdatePaymentInput {
  amount_cents?: number;
  paid_at?: string;
  note?: string | null;
  allow_overpayment?: boolean;
}

async function updatePayment(id: string, payment: UpdatePaymentInput): Promise<Payment> {
  const response = await fetch(`/api/payments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment),
  });
  if (!response.ok) {
    await throwPaymentError(response, 'Failed to update payment');
  }
  return response.json();
}

async function deletePayment(id: string): Promise<void> {
  const response = await fetch(`/api/payments/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete payment');
  }
}

// Everything payments affect: balances change, so plans, analytics and the
// activity log are all stale after any payment mutation.
export const PAYMENT_RELATED_KEYS = [
  ['payments'],
  ['debts'],
  ['payoffPlan'],
  ['analytics'],
  ['activity'],
] as const;

function invalidatePaymentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of PAYMENT_RELATED_KEYS) {
    queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export function usePayments(debtId?: string) {
  return useQuery({
    queryKey: debtId ? ['payments', debtId] : ['payments'],
    queryFn: () => fetchPayments(debtId),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => invalidatePaymentQueries(queryClient),
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payment }: { id: string; payment: UpdatePaymentInput }) =>
      updatePayment(id, payment),
    onSuccess: () => invalidatePaymentQueries(queryClient),
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePayment,
    onSuccess: () => invalidatePaymentQueries(queryClient),
  });
}
