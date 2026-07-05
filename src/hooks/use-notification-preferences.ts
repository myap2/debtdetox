'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreferences } from '@/types/database';

export type NotificationToggleKey = keyof Pick<
  NotificationPreferences,
  'email_reminders' | 'weekly_summary' | 'monthly_report' | 'detox_reminders' | 'milestone_alerts'
>;

export type UpdatePreferencesInput = Partial<
  Pick<
    NotificationPreferences,
    | 'email_reminders'
    | 'reminder_days_before'
    | 'weekly_summary'
    | 'monthly_report'
    | 'detox_reminders'
    | 'milestone_alerts'
  >
>;

async function fetchPreferences(): Promise<NotificationPreferences> {
  const response = await fetch('/api/notifications/preferences');
  if (!response.ok) {
    throw new Error('Failed to fetch notification preferences');
  }
  return response.json();
}

async function updatePreferences(
  input: UpdatePreferencesInput
): Promise<NotificationPreferences> {
  const response = await fetch('/api/notifications/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('Failed to update notification preferences');
  }
  return response.json();
}

export function useNotificationPreferences(enabled: boolean = true) {
  return useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: fetchPreferences,
    enabled,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePreferences,
    // Optimistic: flip the toggle immediately, roll back on failure
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['notificationPreferences'] });
      const previous = queryClient.getQueryData<NotificationPreferences>([
        'notificationPreferences',
      ]);
      if (previous) {
        queryClient.setQueryData(['notificationPreferences'], { ...previous, ...input });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notificationPreferences'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
  });
}
