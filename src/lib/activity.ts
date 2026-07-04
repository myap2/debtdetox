import { createClient } from '@/lib/supabase/server';
import type { SessionInfo } from '@/lib/session';
import { calculateBadges } from '@/lib/gamification';
import type { ActivityEventType } from '@/types/database';

export type ActivityMetadata = Record<string, string | number | boolean | null>;

/**
 * Records an activity event for the activity log. Failures are logged but
 * never thrown — activity logging must not break the primary operation.
 */
export async function logActivity(
  session: SessionInfo,
  eventType: ActivityEventType,
  metadata: ActivityMetadata = {}
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('activity_events').insert({
      owner_type: session.type,
      owner_id: session.id,
      event_type: eventType,
      metadata,
    });

    if (error) {
      console.error(`Failed to log activity event ${eventType}:`, error);
    }
  } catch (error) {
    console.error(`Failed to log activity event ${eventType}:`, error);
  }
}

/**
 * Recomputes the user's badges and logs a badge_earned event for any badge
 * that doesn't have one yet. Called after sprint/win mutations, which are the
 * inputs to badge calculations. Idempotent, and like logActivity never throws.
 */
export async function syncBadgeActivity(session: SessionInfo): Promise<void> {
  try {
    const supabase = await createClient();

    const [{ data: sprints }, { data: existingEvents }] = await Promise.all([
      supabase
        .from('detox_sprints')
        .select('*, detox_wins(*)')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
      supabase
        .from('activity_events')
        .select('metadata')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id)
        .eq('event_type', 'badge_earned'),
    ]);

    const badges = calculateBadges(sprints ?? []);
    const alreadyLogged = new Set(
      (existingEvents ?? []).map((event) => event.metadata?.badge_id).filter(Boolean)
    );

    for (const badge of badges) {
      if (alreadyLogged.has(badge.id)) continue;
      await logActivity(session, 'badge_earned', {
        badge_id: badge.id,
        badge_name: badge.name,
        badge_tier: badge.tier,
      });
    }
  } catch (error) {
    console.error('Failed to sync badge activity:', error);
  }
}
