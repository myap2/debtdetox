/**
 * @jest-environment node
 */

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import { createMockSupabase, type MockSupabaseState } from '@/test/supabase-mock';

const DEBT_ID = '11111111-1111-4111-8111-111111111111';
const DEBT_2_ID = '22222222-2222-4222-8222-222222222222';

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

function makeDebt(overrides: Record<string, unknown> = {}) {
  return {
    id: DEBT_ID,
    owner_type: 'session',
    owner_id: 'test-session-id',
    name: 'Chase Sapphire',
    type: 'credit_card',
    balance_cents: 100000,
    apr_bps: 2000,
    min_payment_cents: 5000,
    due_day: null,
    ...overrides,
  };
}

function paymentRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Payments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state = {
      tables: {
        debts: [makeDebt()],
        payments: [],
      },
      user: null,
    };
  });

  describe('POST /api/payments', () => {
    it('should record a payment and reduce the debt balance', async () => {
      const response = await POST(
        paymentRequest({
          debt_id: DEBT_ID,
          amount_cents: 25000,
          paid_at: '2026-07-01',
          note: 'Extra from bonus',
        })
      );
      const payment = await response.json();

      expect(response.status).toBe(201);
      expect(payment.amount_cents).toBe(25000);
      expect(payment.balance_delta_cents).toBe(25000);
      expect(payment.note).toBe('Extra from bonus');
      expect(state.tables.debts[0].balance_cents).toBe(75000);
    });

    it('should reject a zero or negative payment', async () => {
      for (const amount of [0, -500]) {
        const response = await POST(
          paymentRequest({ debt_id: DEBT_ID, amount_cents: amount, paid_at: '2026-07-01' })
        );
        expect(response.status).toBe(400);
      }
      expect(state.tables.payments).toHaveLength(0);
      expect(state.tables.debts[0].balance_cents).toBe(100000);
    });

    it('should reject a missing or malformed payment date', async () => {
      const missing = await POST(
        paymentRequest({ debt_id: DEBT_ID, amount_cents: 1000 })
      );
      expect(missing.status).toBe(400);

      const malformed = await POST(
        paymentRequest({ debt_id: DEBT_ID, amount_cents: 1000, paid_at: 'July 1st' })
      );
      expect(malformed.status).toBe(400);
    });

    it('should return 404 for a debt the session does not own', async () => {
      state.tables.debts[0].owner_id = 'someone-else';

      const response = await POST(
        paymentRequest({ debt_id: DEBT_ID, amount_cents: 1000, paid_at: '2026-07-01' })
      );

      expect(response.status).toBe(404);
    });

    it('should return 422 with the remaining balance when payment exceeds it', async () => {
      const response = await POST(
        paymentRequest({ debt_id: DEBT_ID, amount_cents: 150000, paid_at: '2026-07-01' })
      );
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body.code).toBe('EXCEEDS_BALANCE');
      expect(body.remaining_balance_cents).toBe(100000);
      expect(state.tables.payments).toHaveLength(0);
      expect(state.tables.debts[0].balance_cents).toBe(100000);
    });

    it('should allow a confirmed overpayment, clamping the balance at zero', async () => {
      const response = await POST(
        paymentRequest({
          debt_id: DEBT_ID,
          amount_cents: 150000,
          paid_at: '2026-07-01',
          allow_overpayment: true,
        })
      );
      const payment = await response.json();

      expect(response.status).toBe(201);
      // Full amount recorded, but only the remaining balance was applied
      expect(payment.amount_cents).toBe(150000);
      expect(payment.balance_delta_cents).toBe(100000);
      expect(state.tables.debts[0].balance_cents).toBe(0);
    });
  });

  describe('GET /api/payments', () => {
    it('should return payments for the session, optionally filtered by debt', async () => {
      state.tables.payments = [
        {
          id: 'p1',
          owner_type: 'session',
          owner_id: 'test-session-id',
          debt_id: DEBT_ID,
          amount_cents: 1000,
          balance_delta_cents: 1000,
          note: null,
          paid_at: '2026-06-01',
        },
        {
          id: 'p2',
          owner_type: 'session',
          owner_id: 'test-session-id',
          debt_id: DEBT_2_ID,
          amount_cents: 2000,
          balance_delta_cents: 2000,
          note: null,
          paid_at: '2026-06-15',
        },
      ];

      const all = await GET(new NextRequest('http://localhost/api/payments'));
      expect(all.status).toBe(200);
      expect(await all.json()).toHaveLength(2);

      const filtered = await GET(
        new NextRequest(`http://localhost/api/payments?debt_id=${DEBT_ID}`)
      );
      const filteredBody = await filtered.json();
      expect(filteredBody).toHaveLength(1);
      expect(filteredBody[0].id).toBe('p1');
    });
  });
});
