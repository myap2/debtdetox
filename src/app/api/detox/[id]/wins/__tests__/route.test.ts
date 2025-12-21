/**
 * @jest-environment node
 */

import { POST } from '../route';

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
        insert: (data: unknown) => {
          mockInsert(data);
          return {
            select: () => ({
              single: () => mockSingle(),
            }),
          };
        },
      };
    },
  }),
}));

describe('Detox Wins API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/detox/[id]/wins', () => {
    it('should create a new win for active sprint', async () => {
      // Sprint exists and is active
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'sprint-123', status: 'active' }, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'win-new',
            sprint_id: 'sprint-123',
            description: 'Made lunch at home',
            amount_saved_cents: 1500,
          },
          error: null,
        });

      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Made lunch at home',
          amount_saved_cents: 1500,
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.description).toBe('Made lunch at home');
      expect(data.amount_saved_cents).toBe(1500);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          sprint_id: 'sprint-123',
          description: 'Made lunch at home',
          amount_saved_cents: 1500,
        })
      );
    });

    it('should create a win without amount_saved_cents', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'sprint-123', status: 'active' }, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'win-new',
            description: 'Resisted temptation',
            amount_saved_cents: null,
          },
          error: null,
        });

      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Resisted temptation',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(response.status).toBe(201);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_saved_cents: null,
        })
      );
    });

    it('should return 400 for missing description', async () => {
      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          amount_saved_cents: 1000,
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty description', async () => {
      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: '',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for negative amount', async () => {
      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test win',
          amount_saved_cents: -100,
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });

      expect(response.status).toBe(400);
    });

    it('should return 404 when sprint not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const request = new Request('http://localhost/api/detox/nonexistent/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test win',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Sprint not found');
    });

    it('should return 400 when sprint is completed', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'sprint-123', status: 'completed' },
        error: null,
      });

      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test win',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot add wins to an inactive sprint');
    });

    it('should return 400 when sprint is abandoned', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'sprint-123', status: 'abandoned' },
        error: null,
      });

      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test win',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot add wins to an inactive sprint');
    });

    it('should return 500 when insert fails', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: { id: 'sprint-123', status: 'active' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      const request = new Request('http://localhost/api/detox/sprint-123/wins', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Test win',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'sprint-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to log win');
    });
  });
});
