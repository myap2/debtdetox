import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications';
import { z } from 'zod';

const updatePreferencesSchema = z.object({
  email_reminders: z.boolean().optional(),
  reminder_days_before: z.number().int().min(1).max(14).optional(),
  weekly_summary: z.boolean().optional(),
  monthly_report: z.boolean().optional(),
  detox_reminders: z.boolean().optional(),
  milestone_alerts: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to manage notification preferences' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notification preferences' },
        { status: 500 }
      );
    }

    // No row yet — return defaults; a row is created on first change.
    return NextResponse.json(data ?? { user_id: user.id, ...DEFAULT_NOTIFICATION_PREFERENCES });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to manage notification preferences' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: user.id, ...parsed.data },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to update notification preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
