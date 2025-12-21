import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSession } from '@/lib/session';
import { z } from 'zod';
import {
  calculateInvestmentGrowth,
  calculateRetirementProjection,
} from '@/lib/investment-engine';
import type { InvestmentInput, InvestmentCalculationOptions } from '@/lib/investment-engine';

const inlineInvestmentSchema = z.object({
  initial_balance_cents: z.number().int().min(0),
  monthly_contribution_cents: z.number().int().min(0),
  annual_return_bps: z.number().int(),
  tax_status: z.enum(['taxable', 'tax_deferred', 'tax_free']),
  tax_rate_bps: z.number().int().optional().default(2500),
  inflation_rate_bps: z.number().int().optional().default(300),
});

const projectSchema = z.object({
  investment_id: z.string().uuid().optional(),
  investment: inlineInvestmentSchema.optional(),
  years: z.number().int().min(1).max(100),
  include_inflation: z.boolean().optional().default(true),
  include_taxes: z.boolean().optional().default(true),
  target_amount_cents: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { investment_id, investment: inlineInvestment, years, include_inflation, include_taxes, target_amount_cents } = parsed.data;

    let investmentInput: InvestmentInput;

    if (investment_id) {
      // Fetch from database
      const session = await getOrCreateSession();
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('id', investment_id)
        .eq('owner_type', session.type)
        .eq('owner_id', session.id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Investment not found' },
          { status: 404 }
        );
      }

      investmentInput = {
        id: data.id,
        name: data.name,
        initial_balance_cents: data.initial_balance_cents,
        monthly_contribution_cents: data.monthly_contribution_cents,
        annual_return_bps: data.annual_return_bps,
        tax_status: data.tax_status,
        tax_rate_bps: data.tax_rate_bps,
        inflation_rate_bps: data.inflation_rate_bps,
      };
    } else if (inlineInvestment) {
      // Use inline investment data
      investmentInput = {
        id: 'inline',
        name: 'Quick Calculation',
        initial_balance_cents: inlineInvestment.initial_balance_cents,
        monthly_contribution_cents: inlineInvestment.monthly_contribution_cents,
        annual_return_bps: inlineInvestment.annual_return_bps,
        tax_status: inlineInvestment.tax_status,
        tax_rate_bps: inlineInvestment.tax_rate_bps,
        inflation_rate_bps: inlineInvestment.inflation_rate_bps,
      };
    } else {
      return NextResponse.json(
        { error: 'Either investment_id or investment data is required' },
        { status: 400 }
      );
    }

    const options: InvestmentCalculationOptions = {
      years,
      include_inflation,
      include_taxes,
      compound_frequency: 'monthly',
    };

    // If target amount provided, use retirement projection
    if (target_amount_cents) {
      const result = calculateRetirementProjection(
        investmentInput,
        target_amount_cents,
        years
      );
      return NextResponse.json(result);
    }

    // Standard growth projection
    const result = calculateInvestmentGrowth(investmentInput, options);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
