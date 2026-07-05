import type { NotificationKind } from './types';

/**
 * Scheduling placeholders for recurring notifications.
 *
 * These jobs are designed to be triggered by an external scheduler —
 * Vercel Cron, Supabase pg_cron calling an edge function, or any host that
 * can hit an API route on a schedule. Each job should:
 *
 *   1. Query the users whose preference for the job's kind is enabled
 *      (see NOTIFICATION_PREFERENCE_KEYS in types.ts).
 *   2. Build the email content from the user's current data.
 *   3. Deliver via sendNotification() in service.ts, which re-checks
 *      preferences and routes through the configured EmailProvider.
 */
export interface ScheduledJob {
  kind: NotificationKind;
  /** Cron expression the host scheduler should use. */
  schedule: string;
  description: string;
}

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    kind: 'weekly_summary',
    schedule: '0 14 * * 1', // Mondays 14:00 UTC
    description: 'Weekly progress summary: balances, payments logged, plan status',
  },
  {
    kind: 'monthly_report',
    schedule: '0 14 1 * *', // 1st of the month 14:00 UTC
    description: 'Monthly progress report: debt reduction, interest saved, milestones',
  },
  {
    kind: 'payment_reminder',
    schedule: '0 14 * * *', // Daily; filters debts due within reminder_days_before
    description: 'Reminds users of upcoming debt payment due dates',
  },
  {
    kind: 'detox_reminder',
    schedule: '0 14 * * *', // Daily; only users with an active sprint
    description: 'Spending freeze check-in during active detox sprints',
  },
];
