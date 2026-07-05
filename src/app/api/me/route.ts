import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'debtdetox_session_id';

export async function GET() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    // Get user info if authenticated
    let user = null;
    if (session.type === 'user') {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    // Get counts
    const [debtsResult, sprintsResult] = await Promise.all([
      supabase
        .from('debts')
        .select('id', { count: 'exact' })
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
      supabase
        .from('detox_sprints')
        .select('id', { count: 'exact' })
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
    ]);

    return NextResponse.json({
      session_type: session.type,
      session_id: session.id,
      user: user
        ? {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
          }
        : null,
      stats: {
        debts_count: debtsResult.count ?? 0,
        sprints_count: sprintsResult.count ?? 0,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    // Delete all user data (order matters due to foreign keys)
    // First delete detox_wins (via cascade), then sprints
    await supabase
      .from('detox_sprints')
      .delete()
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    // Delete payments
    await supabase
      .from('payments')
      .delete()
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    // Delete plan_snapshots (via cascade), then plans
    await supabase
      .from('plans')
      .delete()
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    // Delete debts
    await supabase
      .from('debts')
      .delete()
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    // Delete investments
    await supabase
      .from('investments')
      .delete()
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    // Delete activity log
    await supabase
      .from('activity_events')
      .delete()
      .eq('owner_type', session.type)
      .eq('owner_id', session.id);

    // If authenticated user, sign out and delete auth user
    if (session.type === 'user') {
      // Note: Deleting auth user requires admin privileges
      // For now, just sign out
      await supabase.auth.signOut();
    } else {
      // Delete session record and clear cookie
      await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id);

      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE_NAME);
    }

    return NextResponse.json({ success: true, message: 'All data deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 });
  }
}
