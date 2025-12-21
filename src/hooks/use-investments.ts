'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Investment, InvestmentType, TaxStatus } from '@/types/database';

async function fetchInvestments(): Promise<Investment[]> {
  const response = await fetch('/api/investments');
  if (!response.ok) {
    throw new Error('Failed to fetch investments');
  }
  return response.json();
}

export interface CreateInvestmentInput {
  name: string;
  type: InvestmentType;
  initial_balance_cents: number;
  monthly_contribution_cents: number;
  annual_return_bps: number;
  tax_status: TaxStatus;
  tax_rate_bps?: number;
  inflation_rate_bps?: number;
  target_amount_cents?: number | null;
  target_years?: number | null;
}

async function createInvestment(investment: CreateInvestmentInput): Promise<Investment> {
  const response = await fetch('/api/investments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(investment),
  });
  if (!response.ok) {
    throw new Error('Failed to create investment');
  }
  return response.json();
}

async function updateInvestment(
  id: string,
  investment: Partial<CreateInvestmentInput>
): Promise<Investment> {
  const response = await fetch(`/api/investments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(investment),
  });
  if (!response.ok) {
    throw new Error('Failed to update investment');
  }
  return response.json();
}

async function deleteInvestment(id: string): Promise<void> {
  const response = await fetch(`/api/investments/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete investment');
  }
}

export function useInvestments() {
  return useQuery({
    queryKey: ['investments'],
    queryFn: fetchInvestments,
  });
}

export function useCreateInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvestment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investmentProjection'] });
    },
  });
}

export function useUpdateInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, investment }: { id: string; investment: Partial<CreateInvestmentInput> }) =>
      updateInvestment(id, investment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investmentProjection'] });
    },
  });
}

export function useDeleteInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInvestment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investmentProjection'] });
    },
  });
}
