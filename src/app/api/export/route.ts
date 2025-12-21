import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    // Fetch all user data
    const [debtsResult, plansResult, paymentsResult, sprintsResult] = await Promise.all([
      supabase
        .from('debts')
        .select('*')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
      supabase
        .from('plans')
        .select('*, plan_snapshots(*)')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
      supabase
        .from('payments')
        .select('*')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
      supabase
        .from('detox_sprints')
        .select('*, detox_wins(*)')
        .eq('owner_type', session.type)
        .eq('owner_id', session.id),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      session_type: session.type,
      data: {
        debts: debtsResult.data ?? [],
        plans: plansResult.data ?? [],
        payments: paymentsResult.data ?? [],
        detox_sprints: sprintsResult.data ?? [],
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="debtdetox-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
