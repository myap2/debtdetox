import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';

const VALID_EVENT_TYPES = new Set([
  'debt_added', 'debt_updated', 'debt_deleted',
  'payment_recorded', 'payment_updated', 'payment_deleted',
  'sprint_started', 'sprint_completed', 'sprint_abandoned',
  'badge_earned',
  'investment_saved', 'investment_deleted',
  'plan_saved', 'plan_deleted',
]);

const MAX_EVENTS = 200;

export async function GET(request: Request) {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const types = searchParams.getAll('type').filter((t) => VALID_EVENT_TYPES.has(t));

    let query = supabase
      .from('activity_events')
      .select('*')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .order('created_at', { ascending: false })
      .limit(MAX_EVENTS);

    if (types.length > 0) {
      query = query.in('event_type', types);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activity:', error);
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
