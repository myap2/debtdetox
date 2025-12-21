/**
 * @jest-environment node
 */

import { GET, PATCH, DELETE } from '../route';

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
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

const mockDebt = {
  id: 'debt-123',
  name: 'Test Credit Card',
  type: 'credit_card',
  balance_cents: 500000,
  apr_bps: 1999,
  min_payment_cents: 10000,
  due_day: 15,
  owner_type: 'session',
  owner_id: 'test-session-id',
};

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
                    eq: (col3: string, val3: unknown) => {
                      mockEq(col3, val3);
                      return {
                        single: () => mockSingle(),
                      };
                    },
                    single: () => mockSingle(),
                  };
                },
              };
            },
          };
        },
        update: (data: unknown) => {
          mockUpdate(data);
          return {
            eq: (col: string, val: unknown) => {
              mockEq(col, val);
              return {
                select: () => ({
                  single: () => mockSingle(),
                }),
              };
            },
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: (col: string, val: unknown) => {
              mockEq(col, val);
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  }),
}));

describe('Debts [id] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/debts/[id]', () => {
    it('should return a specific debt', async () => {
      mockSingle.mockResolvedValue({ data: mockDebt, error: null });

      const request = new Request('http://localhost/api/debts/debt-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'debt-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('debt-123');
      expect(data.name).toBe('Test Credit Card');
      expect(mockFrom).toHaveBeenCalledWith('debts');
      expect(mockEq).toHaveBeenCalledWith('id', 'debt-123');
    });

    it('should return 404 when debt not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const request = new Request('http://localhost/api/debts/nonexistent');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Debt not found');
    });

    it('should return 404 when database error occurs', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const request = new Request('http://localhost/api/debts/debt-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'debt-123' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/debts/[id]', () => {
    it('should update a debt with valid data', async () => {
      // First call for ownership check, second for update result
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'debt-123' }, error: null })
        .mockResolvedValueOnce({ data: { ...mockDebt, name: 'Updated Card' }, error: null });

      const request = new Request('http://localhost/api/debts/debt-123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Card' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'debt-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Updated Card');
      expect(mockUpdate).toHaveBeenCalledWith({ name: 'Updated Card' });
    });

    it('should update balance_cents', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'debt-123' }, error: null })
        .mockResolvedValueOnce({ data: { ...mockDebt, balance_cents: 250000 }, error: null });

      const request = new Request('http://localhost/api/debts/debt-123', {
        method: 'PATCH',
        body: JSON.stringify({ balance_cents: 250000 }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'debt-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance_cents).toBe(250000);
    });

    it('should return 404 when debt not found for update', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const request = new Request('http://localhost/api/debts/nonexistent', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Debt not found');
    });

    it('should return 400 for invalid type', async () => {
      const request = new Request('http://localhost/api/debts/debt-123', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'invalid_type' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'debt-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for negative balance', async () => {
      const request = new Request('http://localhost/api/debts/debt-123', {
        method: 'PATCH',
        body: JSON.stringify({ balance_cents: -100 }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'debt-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid due_day', async () => {
      const request = new Request('http://localhost/api/debts/debt-123', {
        method: 'PATCH',
        body: JSON.stringify({ due_day: 32 }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'debt-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 500 when update fails', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'debt-123' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });

      const request = new Request('http://localhost/api/debts/debt-123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'debt-123' }) });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/debts/[id]', () => {
    it('should delete a debt', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'debt-123' }, error: null });

      const request = new Request('http://localhost/api/debts/debt-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'debt-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return 404 when debt not found for deletion', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const request = new Request('http://localhost/api/debts/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Debt not found');
    });
  });
});
