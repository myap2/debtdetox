/**
 * @jest-environment node
 */

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import { createMockSupabase, type MockSupabaseState } from '@/test/supabase-mock';

jest.mock('@/lib/session', () => ({
  getOrCreateSession: jest.fn().mockResolvedValue({
    type: 'session',
    id: 'test-session-id',
  }),
}));

jest.mock('@/lib/activity', () => ({
  logActivity: jest.fn().mockResolvedValue(undefined),
  syncBadgeActivity: jest.fn().mockResolvedValue(undefined),
}));

let state: MockSupabaseState;

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(createMockSupabase(state))),
}));

function planRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Plans API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state = {
      tables: {
        debts: [
          {
            id: 'debt-1',
            owner_type: 'session',
            owner_id: 'test-session-id',
            name: 'Card A',
            type: 'credit_card',
            balance_cents: 100000,
            apr_bps: 2400,
            min_payment_cents: 5000,
          },
          {
            id: 'debt-2',
            owner_type: 'session',
            owner_id: 'test-session-id',
            name: 'Loan B',
            type: 'personal',
            balance_cents: 50000,
            apr_bps: 900,
            min_payment_cents: 2500,
          },
        ],
        plans: [],
        plan_snapshots: [],
      },
      user: null,
    };
  });

  describe('POST /api/plans', () => {
    it('should save a plan with a full computed snapshot', async () => {
      const response = await POST(
        planRequest({ name: 'My Avalanche', strategy: 'avalanche', extra_payment_cents: 10000 })
      );
      const plan = await response.json();

      expect(response.status).toBe(201);
      expect(plan.name).toBe('My Avalanche');
      expect(plan.strategy).toBe('avalanche');
      expect(plan.extra_payment_cents).toBe(10000);

      expect(state.tables.plan_snapshots).toHaveLength(1);
      const snapshot = state.tables.plan_snapshots[0] as {
        plan_id: string;
        total_interest_cents: number;
        debt_free_date: string;
        snapshot_json: {
          strategy: string;
          debts: unknown[];
          result: { schedule: unknown[]; months_to_payoff: number };
          comparison: { faster_strategy: string };
        };
      };

      expect(snapshot.plan_id).toBe(plan.id);
      expect(snapshot.total_interest_cents).toBeGreaterThan(0);
      expect(snapshot.debt_free_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Snapshot preserves debts, schedule and comparison for later restore
      expect(snapshot.snapshot_json.debts).toHaveLength(2);
      expect(snapshot.snapshot_json.result.schedule.length).toBe(
        snapshot.snapshot_json.result.months_to_payoff
      );
      expect(['snowball', 'avalanche']).toContain(
        snapshot.snapshot_json.comparison.faster_strategy
      );
    });

    it('should reject an empty name', async () => {
      const response = await POST(planRequest({ name: '', strategy: 'avalanche' }));
      expect(response.status).toBe(400);
      expect(state.tables.plans).toHaveLength(0);
    });

    it('should return 400 when the user has no debts', async () => {
      state.tables.debts = [];

      const response = await POST(planRequest({ name: 'Plan', strategy: 'snowball' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('No debts found');
    });
  });

  describe('GET /api/plans', () => {
    it('should list plans with their latest snapshot summary', async () => {
      await POST(planRequest({ name: 'Plan One', strategy: 'snowball' }));

      const response = await GET();
      const plans = await response.json();

      expect(response.status).toBe(200);
      expect(plans).toHaveLength(1);
      expect(plans[0].name).toBe('Plan One');
      expect(plans[0].total_interest_cents).toBeGreaterThan(0);
      expect(plans[0].debt_free_date).toBeTruthy();
      // Full snapshot payload should not leak into the list response
      expect(plans[0].snapshot_json).toBeUndefined();
    });
  });
});
