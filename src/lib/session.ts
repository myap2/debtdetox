import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const SESSION_COOKIE_NAME = 'debtdetox_session_id';

export interface SessionInfo {
  type: 'session' | 'user';
  id: string;
}

export async function getOrCreateSession(): Promise<SessionInfo> {
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return { type: 'user', id: user.id };
  }

  // Check for existing anonymous session
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    // Verify session exists and is not expired
    const { data: session } = await supabase
      .from('sessions')
      .select('id, expires_at, merged_into_user_id')
      .eq('id', sessionId)
      .single();

    if (session && !session.merged_into_user_id && new Date(session.expires_at) > new Date()) {
      // Update last_seen_at
      await supabase
        .from('sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sessionId);

      return { type: 'session', id: sessionId };
    }
  }

  // Create new anonymous session
  const { data: newSession, error } = await supabase
    .from('sessions')
    .insert({})
    .select('id')
    .single();

  if (error || !newSession) {
    throw new Error('Failed to create session');
  }

  // Set cookie
  cookieStore.set(SESSION_COOKIE_NAME, newSession.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return { type: 'session', id: newSession.id };
}

export async function getCurrentSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return { type: 'user', id: user.id };
  }

  // Check for existing anonymous session
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  // Verify session exists and is not expired
  const { data: session } = await supabase
    .from('sessions')
    .select('id, expires_at, merged_into_user_id')
    .eq('id', sessionId)
    .single();

  if (!session || session.merged_into_user_id || new Date(session.expires_at) <= new Date()) {
    return null;
  }

  return { type: 'session', id: sessionId };
}

export async function mergeSessionToUser(sessionId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  // Update all data from session to user
  const tables = ['debts', 'plans', 'payments', 'detox_sprints', 'investments', 'activity_events'] as const;

  for (const table of tables) {
    await supabase
      .from(table)
      .update({ owner_type: 'user', owner_id: userId })
      .eq('owner_type', 'session')
      .eq('owner_id', sessionId);
  }

  // Mark session as merged
  await supabase
    .from('sessions')
    .update({ merged_into_user_id: userId })
    .eq('id', sessionId);
}
