import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_KEYS,
  type EmailMessage,
  type EmailProvider,
  type NotificationKind,
} from './types';

/**
 * Development provider: logs instead of sending. Swap in a real provider
 * (Resend, SendGrid, Postmark, ...) by implementing EmailProvider and
 * returning it from getEmailProvider() based on env configuration.
 */
class ConsoleEmailProvider implements EmailProvider {
  name = 'console';

  async send(message: EmailMessage): Promise<{ id: string }> {
    console.info(`[notifications] would send "${message.subject}" to ${message.to}`);
    return { id: `console-${Date.now()}` };
  }
}

export function getEmailProvider(): EmailProvider {
  // Future: switch on process.env.EMAIL_PROVIDER ('resend' | 'sendgrid' | ...)
  // and construct the matching provider with its API key.
  return new ConsoleEmailProvider();
}

/**
 * Sends a notification email if (and only if) the user has the matching
 * preference enabled. Intended to be called from scheduled jobs (see
 * scheduler.ts); safe to call from API routes for event-driven notifications.
 */
export async function sendNotification(
  userId: string,
  email: string,
  kind: NotificationKind,
  message: Omit<EmailMessage, 'to'>
): Promise<{ sent: boolean; reason?: string }> {
  const supabase = await createClient();

  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const effective = preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  const preferenceKey = NOTIFICATION_PREFERENCE_KEYS[kind];

  if (!effective[preferenceKey]) {
    return { sent: false, reason: `User disabled ${preferenceKey}` };
  }

  await getEmailProvider().send({ to: email, ...message });
  return { sent: true };
}
