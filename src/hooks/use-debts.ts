'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Debt } from '@/types/database';

async function fetchDebts(): Promise<Debt[]> {
  const response = await fetch('/api/debts');
  if (!response.ok) {
    throw new Error('Failed to fetch debts');
  }
  return response.json();
}

interface CreateDebtInput {
  name: string;
  balance_cents: number;
  apr_bps: number;
  min_payment_cents: number;
  category?: string;
}

async function createDebt(debt: CreateDebtInput): Promise<Debt> {
  const response = await fetch('/api/debts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(debt),
  });
  if (!response.ok) {
    throw new Error('Failed to create debt');
  }
  return response.json();
}

async function updateDebt(id: string, debt: Partial<CreateDebtInput>): Promise<Debt> {
  const response = await fetch(`/api/debts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(debt),
  });
  if (!response.ok) {
    throw new Error('Failed to update debt');
  }
  return response.json();
}

async function deleteDebt(id: string): Promise<void> {
  const response = await fetch(`/api/debts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete debt');
  }
}

export function useDebts() {
  return useQuery({
    queryKey: ['debts'],
    queryFn: fetchDebts,
  });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDebt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['payoffPlan'] });
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, debt }: { id: string; debt: Partial<CreateDebtInput> }) =>
      updateDebt(id, debt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['payoffPlan'] });
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDebt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['payoffPlan'] });
    },
  });
}
