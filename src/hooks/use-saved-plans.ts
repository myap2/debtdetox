'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Plan, PlanSnapshot, PayoffStrategy } from '@/types/database';

// Shape returned by GET /api/plans: plan fields plus latest snapshot summary
export interface SavedPlanSummary {
  id: string;
  name: string;
  strategy: PayoffStrategy;
  extra_payment_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_interest_cents: number | null;
  debt_free_date: string | null;
  snapshot_created_at: string | null;
}

export interface SavedPlanDetail extends Plan {
  snapshot: PlanSnapshot | null;
}

async function fetchPlans(): Promise<SavedPlanSummary[]> {
  const response = await fetch('/api/plans');
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  return response.json();
}

async function fetchPlan(id: string): Promise<SavedPlanDetail> {
  const response = await fetch(`/api/plans/${id}`);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to fetch plan');
  }
  return response.json();
}

export interface SavePlanInput {
  name: string;
  strategy: 'snowball' | 'avalanche';
  extra_payment_cents: number;
}

async function savePlan(input: SavePlanInput): Promise<Plan> {
  const response = await fetch('/api/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to save plan');
  }
  return response.json();
}

async function renamePlan(id: string, name: string): Promise<Plan> {
  const response = await fetch(`/api/plans/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error('Failed to rename plan');
  }
  return response.json();
}

async function duplicatePlan(id: string): Promise<Plan> {
  const response = await fetch(`/api/plans/${id}/duplicate`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to duplicate plan');
  }
  return response.json();
}

async function refreshPlan(id: string): Promise<SavedPlanDetail> {
  const response = await fetch(`/api/plans/${id}/refresh`, { method: 'POST' });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Failed to refresh plan');
  }
  return response.json();
}

async function deletePlan(id: string): Promise<void> {
  const response = await fetch(`/api/plans/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete plan');
  }
}

export function useSavedPlans() {
  return useQuery({
    queryKey: ['savedPlans'],
    queryFn: fetchPlans,
  });
}

export function useSavedPlan(id: string | null) {
  return useQuery({
    queryKey: ['savedPlans', id],
    queryFn: () => fetchPlan(id!),
    enabled: !!id,
  });
}

export function useSavePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: savePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPlans'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useRenamePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renamePlan(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPlans'] });
    },
  });
}

export function useDuplicatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicatePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPlans'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useRefreshPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshPlan,
    onSuccess: (data) => {
      queryClient.setQueryData(['savedPlans', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['savedPlans'] });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPlans'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
