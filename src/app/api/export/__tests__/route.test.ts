/**
 * @jest-environment node
 */

import { GET } from '../route';

// Mock the session module
jest.mock('@/lib/session', () => ({
  getOrCreateSession: jest.fn().mockResolvedValue({
    type: 'session',
    id: 'test-session-id',
  }),
}));

// Sample data for export
const mockDebts = [
  { id: 'debt-1', name: 'Credit Card', balance_cents: 500000 },
  { id: 'debt-2', name: 'Student Loan', balance_cents: 2500000 },
];

const mockPlans = [
  { id: 'plan-1', strategy: 'avalanche', plan_snapshots: [] },
];

const mockPayments = [
  { id: 'payment-1', amount_cents: 10000, paid_at: '2024-01-15' },
];

const mockSprints = [
  { id: 'sprint-1', start_date: '2024-01-01', detox_wins: [] },
];

// Mock Supabase
const mockFrom = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: (table: string) => {
      mockFrom(table);
      return {
        select: () => ({
          eq: () => ({
            eq: () => {
              // Return different data based on table
              if (table === 'debts') {
                return Promise.resolve({ data: mockDebts, error: null });
              } else if (table === 'plans') {
                return Promise.resolve({ data: mockPlans, error: null });
              } else if (table === 'payments') {
                return Promise.resolve({ data: mockPayments, error: null });
              } else if (table === 'detox_sprints') {
                return Promise.resolve({ data: mockSprints, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
        }),
      };
    },
  }),
}));

describe('Export API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/export', () => {
    it('should return all user data as JSON', async () => {
      const response = await GET();
      const text = await response.text();
      const data = JSON.parse(text);

      expect(response.status).toBe(200);
      expect(data.exported_at).toBeDefined();
      expect(data.session_type).toBe('session');
      expect(data.data).toBeDefined();
    });

    it('should include debts in export', async () => {
      const response = await GET();
      const text = await response.text();
      const data = JSON.parse(text);

      expect(data.data.debts).toHaveLength(2);
      expect(data.data.debts[0].name).toBe('Credit Card');
      expect(mockFrom).toHaveBeenCalledWith('debts');
    });

    it('should include plans in export', async () => {
      const response = await GET();
      const text = await response.text();
      const data = JSON.parse(text);

      expect(data.data.plans).toHaveLength(1);
      expect(data.data.plans[0].strategy).toBe('avalanche');
      expect(mockFrom).toHaveBeenCalledWith('plans');
    });

    it('should include payments in export', async () => {
      const response = await GET();
      const text = await response.text();
      const data = JSON.parse(text);

      expect(data.data.payments).toHaveLength(1);
      expect(data.data.payments[0].amount_cents).toBe(10000);
      expect(mockFrom).toHaveBeenCalledWith('payments');
    });

    it('should include detox_sprints in export', async () => {
      const response = await GET();
      const text = await response.text();
      const data = JSON.parse(text);

      expect(data.data.detox_sprints).toHaveLength(1);
      expect(mockFrom).toHaveBeenCalledWith('detox_sprints');
    });

    it('should set correct Content-Type header', async () => {
      const response = await GET();

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should set Content-Disposition header for download', async () => {
      const response = await GET();
      const disposition = response.headers.get('Content-Disposition');

      expect(disposition).toContain('attachment');
      expect(disposition).toContain('debtdetox-export-');
      expect(disposition).toContain('.json');
    });

    it('should format JSON with indentation', async () => {
      const response = await GET();
      const text = await response.text();

      // Pretty-printed JSON should have newlines
      expect(text).toContain('\n');
    });

    it('should fetch data from all four tables', async () => {
      await GET();

      expect(mockFrom).toHaveBeenCalledWith('debts');
      expect(mockFrom).toHaveBeenCalledWith('plans');
      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(mockFrom).toHaveBeenCalledWith('detox_sprints');
    });
  });
});
