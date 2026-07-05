'use client';

import { Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationToggleKey,
} from '@/hooks/use-notification-preferences';

const notificationOptions: {
  key: NotificationToggleKey;
  label: string;
  description: string;
  toastLabel: string;
}[] = [
  {
    key: 'email_reminders',
    label: 'Debt Payment Reminders',
    description: 'Get reminded before payment due dates',
    toastLabel: 'Payment reminders',
  },
  {
    key: 'weekly_summary',
    label: 'Weekly Summary',
    description: 'Receive a weekly progress report',
    toastLabel: 'Weekly summary',
  },
  {
    key: 'monthly_report',
    label: 'Monthly Progress Report',
    description: 'A monthly recap of balances, payments, and interest saved',
    toastLabel: 'Monthly report',
  },
  {
    key: 'detox_reminders',
    label: 'Spending Freeze Reminders',
    description: 'Check-ins while a detox sprint is active',
    toastLabel: 'Spending freeze reminders',
  },
  {
    key: 'milestone_alerts',
    label: 'Milestone Notifications',
    description: 'Celebrate paid-off debts, badges, and payoff milestones',
    toastLabel: 'Milestone notifications',
  },
];

export function NotificationSettings() {
  const { data: preferences, isLoading, error } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  // Saves immediately on change; the hook applies the flip optimistically
  // and rolls back if the request fails.
  function handleToggle(key: NotificationToggleKey, toastLabel: string, checked: boolean) {
    updatePreferences.mutate(
      { [key]: checked },
      {
        onSuccess: () => {
          toast.success(`${toastLabel} ${checked ? 'enabled' : 'disabled'}`);
        },
        onError: () => {
          toast.error('Failed to save preference');
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Configure how you want to be notified. Changes save automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error || !preferences ? (
          <p className="text-sm text-muted-foreground">
            Notification preferences could not be loaded. Please try again later.
          </p>
        ) : (
          notificationOptions.map((option, index) => (
            <Fragment key={option.key}>
              {index > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`notify-${option.key}`}>{option.label}</Label>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                <Checkbox
                  id={`notify-${option.key}`}
                  checked={preferences[option.key]}
                  onCheckedChange={(checked) =>
                    handleToggle(option.key, option.toastLabel, checked === true)
                  }
                  aria-label={option.label}
                />
              </div>
            </Fragment>
          ))
        )}
      </CardContent>
    </Card>
  );
}
