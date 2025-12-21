'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DetoxSprint, DetoxWin } from '@/types/database';

interface SprintWithWins extends DetoxSprint {
  detox_wins: DetoxWin[];
}

async function fetchSprints(): Promise<SprintWithWins[]> {
  const response = await fetch('/api/detox');
  if (!response.ok) {
    throw new Error('Failed to fetch sprints');
  }
  return response.json();
}

interface CreateSprintInput {
  name: string;
  goal_description: string;
  duration_days: number;
  target_savings_cents: number;
}

async function createSprint(sprint: CreateSprintInput): Promise<DetoxSprint> {
  const response = await fetch('/api/detox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sprint),
  });
  if (!response.ok) {
    throw new Error('Failed to create sprint');
  }
  return response.json();
}

async function updateSprint(
  id: string,
  data: { status?: string; actual_savings_cents?: number }
): Promise<DetoxSprint> {
  const response = await fetch(`/api/detox/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update sprint');
  }
  return response.json();
}

interface LogWinInput {
  sprintId: string;
  amount_cents: number;
  description: string;
}

async function logWin(input: LogWinInput): Promise<DetoxWin> {
  const response = await fetch(`/api/detox/${input.sprintId}/wins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_cents: input.amount_cents,
      description: input.description,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to log win');
  }
  return response.json();
}

export function useDetoxSprints() {
  return useQuery({
    queryKey: ['detoxSprints'],
    queryFn: fetchSprints,
  });
}

export function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detoxSprints'] });
    },
  });
}

export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; actual_savings_cents?: number } }) =>
      updateSprint(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detoxSprints'] });
    },
  });
}

export function useLogWin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logWin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detoxSprints'] });
    },
  });
}
