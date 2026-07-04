import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { z } from 'zod';

const createInvestmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    'stocks',
    'bonds',
    'retirement_401k',
    'retirement_ira',
    'real_estate',
    'savings',
    'crypto',
    'custom',
  ]),
  initial_balance_cents: z.number().int().min(0),
  monthly_contribution_cents: z.number().int().min(0),
  annual_return_bps: z.number().int().min(-10000).max(100000),
  tax_status: z.enum(['taxable', 'tax_deferred', 'tax_free']),
  tax_rate_bps: z.number().int().min(0).max(10000).optional().default(2500),
  inflation_rate_bps: z.number().int().min(0).max(10000).optional().default(300),
  target_amount_cents: z.number().int().min(0).nullable().optional(),
  target_years: z.number().int().min(1).max(100).nullable().optional(),
});

export async function GET() {
  try {
    const session = await getOrCreateSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .eq('owner_type', session.type)
      .eq('owner_id', session.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching investments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch investments' },
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

export async function POST(request: Request) {
  try {
    const session = await getOrCreateSession();
    const body = await request.json();

    const parsed = createInvestmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('investments')
      .insert({
        owner_type: session.type,
        owner_id: session.id,
        name: parsed.data.name,
        type: parsed.data.type,
        initial_balance_cents: parsed.data.initial_balance_cents,
        monthly_contribution_cents: parsed.data.monthly_contribution_cents,
        annual_return_bps: parsed.data.annual_return_bps,
        tax_status: parsed.data.tax_status,
        tax_rate_bps: parsed.data.tax_rate_bps,
        inflation_rate_bps: parsed.data.inflation_rate_bps,
        target_amount_cents: parsed.data.target_amount_cents ?? null,
        target_years: parsed.data.target_years ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating investment:', error);
      return NextResponse.json(
        { error: 'Failed to create investment' },
        { status: 500 }
      );
    }

    await logActivity(session, 'investment_saved', {
      investment_id: data.id,
      investment_name: data.name,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
