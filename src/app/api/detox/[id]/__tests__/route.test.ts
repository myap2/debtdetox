/**
 * @jest-environment node
 */

import { GET, PATCH } from '../route';

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
const mockEq = jest.fn();
const mockSingle = jest.fn();

const mockSprint = {
  id: 'sprint-123',
  owner_type: 'session',
  owner_id: 'test-session-id',
  start_date: '2024-01-01',
  end_date: '2024-01-07',
  status: 'active',
  rules_json: { no_dining_out: true },
  detox_wins: [
    { id: 'win-1', description: 'Skipped coffee', amount_saved_cents: 500 },
  ],
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
      };
    },
  }),
}));

describe('Detox [id] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/detox/[id]', () => {
    it('should return a specific sprint with wins', async () => {
      mockSingle.mockResolvedValue({ data: mockSprint, error: null });

      const request = new Request('http://localhost/api/detox/sprint-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'sprint-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('sprint-123');
      expect(data.status).toBe('active');
      expect(data.detox_wins).toHaveLength(1);
      expect(mockSelect).toHaveBeenCalledWith('*, detox_wins(*)');
    });

    it('should return 404 when sprint not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const request = new Request('http://localhost/api/detox/nonexistent');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Sprint not found');
    });

    it('should verify ownership', async () => {
      mockSingle.mockResolvedValue({ data: mockSprint, error: null });

      const request = new Request('http://localhost/api/detox/sprint-123');
      await GET(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(mockEq).toHaveBeenCalledWith('owner_type', 'session');
      expect(mockEq).toHaveBeenCalledWith('owner_id', 'test-session-id');
    });
  });

  describe('PATCH /api/detox/[id]', () => {
    it('should update sprint status to completed', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'sprint-123' }, error: null })
        .mockResolvedValueOnce({ data: { ...mockSprint, status: 'completed' }, error: null });

      const request = new Request('http://localhost/api/detox/sprint-123', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'sprint-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('completed');
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should update sprint status to abandoned', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'sprint-123' }, error: null })
        .mockResolvedValueOnce({ data: { ...mockSprint, status: 'abandoned' }, error: null });

      const request = new Request('http://localhost/api/detox/sprint-123', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'abandoned' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid status', async () => {
      const request = new Request('http://localhost/api/detox/sprint-123', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'invalid_status' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 404 when sprint not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const request = new Request('http://localhost/api/detox/nonexistent', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Sprint not found');
    });

    it('should return 500 when update fails', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'sprint-123' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });

      const request = new Request('http://localhost/api/detox/sprint-123', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(response.status).toBe(500);
    });
  });
});
