'use client';

import { useQuery } from '@tanstack/react-query';
import type { ActivityEvent, ActivityEventType } from '@/types/database';

async function fetchActivity(types: ActivityEventType[]): Promise<ActivityEvent[]> {
  const params = new URLSearchParams();
  for (const type of types) {
    params.append('type', type);
  }
  const query = params.toString();
  const response = await fetch(query ? `/api/activity?${query}` : '/api/activity');
  if (!response.ok) {
    throw new Error('Failed to fetch activity');
  }
  return response.json();
}

export function useActivity(types: ActivityEventType[] = []) {
  return useQuery({
    queryKey: ['activity', ...types],
    queryFn: () => fetchActivity(types),
  });
}
