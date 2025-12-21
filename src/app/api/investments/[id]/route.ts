import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { z } from 'zod';

const updateInvestmentSchema = z.object({
  name: z.string().min(1).optional(),
  type: z
    .enum([
      'stocks',
      'bonds',
      'retirement_401k',
      'retirement_ira',
      'real_estate',
      'savings',
      'crypto',
      'custom',
    ])
    .optional(),
  initial_balance_cents: z.number().int().min(0).optional(),
  monthly_contribution_cents: z.number().int().min(0).optional(),
  annual_return_bps: z.number().int().min(-10000).max(100000).optional(),
  tax_status: z.enum(['taxable', 'tax_deferred', 'tax_free']).optional(),
  tax_rate_bps: z.number().int().min(0).max(10000).optional(),
  inflation_rate_bps: z.number().int().min(0).max(10000).optional(),
  target_amount_cents: z.number().int().min(0).nullable().optional(),
  target_years: z.number().int().min(1).max(100).nullable().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = updateInvestmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // First verify ownership
    const { data: existing } = await supabase
      .from('investments')
      .select('id')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('investments')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating investment:', error);
      return NextResponse.json(
        { error: 'Failed to update investment' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrCreateSession();
    const supabase = await createClient();

    // First verify ownership
    const { data: existing } = await supabase
      .from('investments')
      .select('id')
      .eq('id', id)
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    const { error } = await supabase.from('investments').delete().eq('id', id);

    if (error) {
      console.error('Error deleting investment:', error);
      return NextResponse.json(
        { error: 'Failed to delete investment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
