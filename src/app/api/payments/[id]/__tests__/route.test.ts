/**
 * @jest-environment node
 *
 * Regression suite for balance bookkeeping: editing or deleting a payment
 * must restore/reapply debt balances exactly, including overpayments.
 */

import { PATCH, DELETE } from '../route';
import { POST } from '../../route';
import { NextRequest } from 'next/server';
import { createMockSupabase, type MockSupabaseState } from '@/test/supabase-mock';

const DEBT_ID = '11111111-1111-4111-8111-111111111111';

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

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function patchRequest(id: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/payments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function recordPayment(body: Record<string, unknown>) {
  const response = await POST(
    new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
  return response.json();
}

describe('Payments [id] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state = {
      tables: {
        debts: [
          {
            id: DEBT_ID,
            owner_type: 'session',
            owner_id: 'test-session-id',
            name: 'Chase Sapphire',
            type: 'credit_card',
            balance_cents: 100000,
            apr_bps: 2000,
            min_payment_cents: 5000,
            due_day: null,
          },
        ],
        payments: [],
      },
      user: null,
    };
  });

  describe('DELETE /api/payments/[id]', () => {
    it('should restore the debt balance exactly', async () => {
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 30000,
        paid_at: '2026-07-01',
      });
      expect(state.tables.debts[0].balance_cents).toBe(70000);

      const response = await DELETE(
        new NextRequest(`http://localhost/api/payments/${payment.id}`, { method: 'DELETE' }),
        params(payment.id)
      );

      expect(response.status).toBe(200);
      expect(state.tables.payments).toHaveLength(0);
      expect(state.tables.debts[0].balance_cents).toBe(100000);
    });

    it('should restore only the applied delta for an overpayment', async () => {
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 150000,
        paid_at: '2026-07-01',
        allow_overpayment: true,
      });
      expect(state.tables.debts[0].balance_cents).toBe(0);

      await DELETE(
        new NextRequest(`http://localhost/api/payments/${payment.id}`, { method: 'DELETE' }),
        params(payment.id)
      );

      // Restores the original 100000, not the full 150000 paid
      expect(state.tables.debts[0].balance_cents).toBe(100000);
    });

    it('should return 404 for a payment the session does not own', async () => {
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 1000,
        paid_at: '2026-07-01',
      });
      state.tables.payments[0].owner_id = 'someone-else';

      const response = await DELETE(
        new NextRequest(`http://localhost/api/payments/${payment.id}`, { method: 'DELETE' }),
        params(payment.id)
      );

      expect(response.status).toBe(404);
      expect(state.tables.debts[0].balance_cents).toBe(99000);
    });
  });

  describe('PATCH /api/payments/[id]', () => {
    it('should recalculate the balance when the amount changes', async () => {
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 30000,
        paid_at: '2026-07-01',
      });
      expect(state.tables.debts[0].balance_cents).toBe(70000);

      // Lower the payment: balance should rise by the difference
      const lowered = await PATCH(
        patchRequest(payment.id, { amount_cents: 10000 }),
        params(payment.id)
      );
      expect(lowered.status).toBe(200);
      expect(state.tables.debts[0].balance_cents).toBe(90000);
      expect(state.tables.payments[0].balance_delta_cents).toBe(10000);

      // Raise it back up: balance should fall accordingly
      const raised = await PATCH(
        patchRequest(payment.id, { amount_cents: 50000 }),
        params(payment.id)
      );
      expect(raised.status).toBe(200);
      expect(state.tables.debts[0].balance_cents).toBe(50000);
      expect(state.tables.payments[0].balance_delta_cents).toBe(50000);
    });

    it('should reject an edit that exceeds the restored balance without confirmation', async () => {
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 30000,
        paid_at: '2026-07-01',
      });

      const response = await PATCH(
        patchRequest(payment.id, { amount_cents: 120000 }),
        params(payment.id)
      );
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body.code).toBe('EXCEEDS_BALANCE');
      // The restored balance (70000 + 30000) is what the edit is validated against
      expect(body.remaining_balance_cents).toBe(100000);
      // Nothing changed
      expect(state.tables.debts[0].balance_cents).toBe(70000);
      expect(state.tables.payments[0].amount_cents).toBe(30000);
    });

    it('should apply a confirmed overpayment edit and clamp the balance at zero', async () => {
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 30000,
        paid_at: '2026-07-01',
      });

      const response = await PATCH(
        patchRequest(payment.id, { amount_cents: 120000, allow_overpayment: true }),
        params(payment.id)
      );

      expect(response.status).toBe(200);
      expect(state.tables.debts[0].balance_cents).toBe(0);
      expect(state.tables.payments[0].amount_cents).toBe(120000);
      expect(state.tables.payments[0].balance_delta_cents).toBe(100000);
    });

    it('should leave the balance untouched when only date or note change', async () => {
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 30000,
        paid_at: '2026-07-01',
      });

      const response = await PATCH(
        patchRequest(payment.id, { paid_at: '2026-06-15', note: 'Corrected date' }),
        params(payment.id)
      );
      const updated = await response.json();

      expect(response.status).toBe(200);
      expect(updated.paid_at).toBe('2026-06-15');
      expect(updated.note).toBe('Corrected date');
      expect(state.tables.debts[0].balance_cents).toBe(70000);
    });

    it('should survive a full edit/delete cycle with the balance intact (regression)', async () => {
      // Record → edit up → edit down → delete should land exactly back at 100000
      const payment = await recordPayment({
        debt_id: DEBT_ID,
        amount_cents: 20000,
        paid_at: '2026-07-01',
      });
      await PATCH(patchRequest(payment.id, { amount_cents: 60000 }), params(payment.id));
      await PATCH(patchRequest(payment.id, { amount_cents: 5000 }), params(payment.id));
      expect(state.tables.debts[0].balance_cents).toBe(95000);

      await DELETE(
        new NextRequest(`http://localhost/api/payments/${payment.id}`, { method: 'DELETE' }),
        params(payment.id)
      );
      expect(state.tables.debts[0].balance_cents).toBe(100000);
    });
  });
});
