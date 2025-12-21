import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { z } from 'zod';

const createWinSchema = z.object({
  description: z.string().min(1),
  amount_saved_cents: z.number().int().min(0).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sprintId } = await params;
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = createWinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify sprint ownership and active status
    const { data: sprint } = await supabase
      .from('detox_sprints')
      .select('id, status')
      .eq('id', sprintId)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    if (sprint.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot add wins to an inactive sprint' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('detox_wins')
      .insert({
        sprint_id: sprintId,
        description: parsed.data.description,
        amount_saved_cents: parsed.data.amount_saved_cents ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating win:', error);
      return NextResponse.json({ error: 'Failed to log win' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
