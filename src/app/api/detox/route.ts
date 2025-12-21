import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { z } from 'zod';

const createSprintSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  rules_json: z.object({
    no_dining_out: z.boolean().optional(),
    no_subscriptions: z.boolean().optional(),
    no_entertainment: z.boolean().optional(),
    no_shopping: z.boolean().optional(),
    custom_rules: z.array(z.string()).optional(),
  }).nullable().optional(),
});

export async function GET() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('detox_sprints')
      .select('*, detox_wins(*)')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sprints:', error);
      return NextResponse.json({ error: 'Failed to fetch sprints' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = createSprintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if there's already an active sprint
    const { data: existingSprint } = await supabase
      .from('detox_sprints')
      .select('id')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .eq('status', 'active')
      .single();

    if (existingSprint) {
      return NextResponse.json(
        { error: 'You already have an active sprint' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('detox_sprints')
      .insert({
        owner_type: session.type,
        owner_id: session.id,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        rules_json: parsed.data.rules_json ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sprint:', error);
      return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
