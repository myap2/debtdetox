/**
 * @jest-environment node
 */

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the session module
jest.mock('@/lib/session', () => ({
  getOrCreateSession: jest.fn().mockResolvedValue({
    type: 'session',
    id: 'test-session-id',
  }),
}));

// Mock Supabase
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (col: string, val: unknown) => {
              mockEq(col, val);
              return {
                eq: (col2: string, val2: unknown) => {
                  mockEq(col2, val2);
                  return {
                    order: (col: string, opts: unknown) => {
                      mockOrder(col, opts);
                      return Promise.resolve({ data: [], error: null });
                    },
                    single: () => {
                      mockSingle();
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
              };
            },
          };
        },
        insert: (data: unknown) => {
          mockInsert(data);
          return {
            select: () => ({
              single: () => {
                mockSingle();
                return Promise.resolve({
                  data: { id: 'new-debt-id', ...data },
                  error: null,
                });
              },
            }),
          };
        },
      };
    },
  }),
}));

describe('Debts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/debts', () => {
    it('should return debts for the current session', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('debts');
      expect(mockEq).toHaveBeenCalledWith('owner_type', 'session');
      expect(mockEq).toHaveBeenCalledWith('owner_id', 'test-session-id');
    });
  });

  describe('POST /api/debts', () => {
    it('should create a new debt with valid data', async () => {
      const debtData = {
        name: 'Test Credit Card',
        type: 'credit_card',
        balance_cents: 100000,
        apr_bps: 2000,
        min_payment_cents: 5000,
        due_day: 15,
      };

      const request = new NextRequest('http://localhost/api/debts', {
        method: 'POST',
        body: JSON.stringify(debtData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-debt-id');
      expect(mockFrom).toHaveBeenCalledWith('debts');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Credit Card',
          type: 'credit_card',
          balance_cents: 100000,
          owner_type: 'session',
          owner_id: 'test-session-id',
        })
      );
    });

    it('should return 400 for invalid debt type', async () => {
      const invalidData = {
        name: 'Test',
        type: 'invalid_type',
        balance_cents: 100000,
        apr_bps: 2000,
        min_payment_cents: 5000,
      };

      const request = new NextRequest('http://localhost/api/debts', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        name: 'Test',
        // missing type, balance, etc.
      };

      const request = new NextRequest('http://localhost/api/debts', {
        method: 'POST',
        body: JSON.stringify(incompleteData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for negative balance', async () => {
      const invalidData = {
        name: 'Test',
        type: 'credit_card',
        balance_cents: -100,
        apr_bps: 2000,
        min_payment_cents: 5000,
      };

      const request = new NextRequest('http://localhost/api/debts', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
