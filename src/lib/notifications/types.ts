import type { NotificationPreferences } from '@/types/database';

// The notification kinds the app can send. Each maps to a user-facing
// preference toggle in notification_preferences.
export type NotificationKind =
  | 'payment_reminder'
  | 'weekly_summary'
  | 'monthly_report'
  | 'detox_reminder'
  | 'milestone';

// Maps each notification kind to the preference column that gates it.
export const NOTIFICATION_PREFERENCE_KEYS: Record<
  NotificationKind,
  keyof Pick<
    NotificationPreferences,
    'email_reminders' | 'weekly_summary' | 'monthly_report' | 'detox_reminders' | 'milestone_alerts'
  >
> = {
  payment_reminder: 'email_reminders',
  weekly_summary: 'weekly_summary',
  monthly_report: 'monthly_report',
  detox_reminder: 'detox_reminders',
  milestone: 'milestone_alerts',
};

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  email_reminders: true,
  reminder_days_before: 3,
  weekly_summary: true,
  monthly_report: true,
  detox_reminders: true,
  milestone_alerts: true,
} as const;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Interface for pluggable email providers (Resend, SendGrid, Postmark, ...).
 * Implement this and register it in `getEmailProvider()` to enable delivery.
 */
export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}
