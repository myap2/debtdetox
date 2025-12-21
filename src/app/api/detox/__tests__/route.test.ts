/**
 * @jest-environment node
 */

import { GET, POST } from '../route';

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

const mockSprints = [
  {
    id: 'sprint-1',
    owner_type: 'session',
    owner_id: 'test-session-id',
    start_date: '2024-01-01',
    end_date: '2024-01-07',
    status: 'completed',
    rules_json: { no_dining_out: true },
    detox_wins: [
      { id: 'win-1', amount_cents: 5000, description: 'Skipped coffee' },
    ],
  },
  {
    id: 'sprint-2',
    owner_type: 'session',
    owner_id: 'test-session-id',
    start_date: '2024-01-15',
    end_date: '2024-01-21',
    status: 'active',
    rules_json: { no_shopping: true, no_entertainment: true },
    detox_wins: [],
  },
];

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
                    order: (col: string, opts: unknown) => {
                      mockOrder(col, opts);
                      return Promise.resolve({ data: mockSprints, error: null });
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

describe('Detox API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/detox', () => {
    it('should return all sprints with wins', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith('detox_sprints');
      expect(mockSelect).toHaveBeenCalledWith('*, detox_wins(*)');
      expect(mockEq).toHaveBeenCalledWith('owner_type', 'session');
      expect(mockEq).toHaveBeenCalledWith('owner_id', 'test-session-id');
    });

    it('should include detox_wins in response', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data[0].detox_wins).toBeDefined();
      expect(data[0].detox_wins).toHaveLength(1);
      expect(data[0].detox_wins[0].description).toBe('Skipped coffee');
    });
  });

  describe('POST /api/detox', () => {
    it('should create a new sprint with valid data', async () => {
      // First call checks for active sprint (none exists)
      mockSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'new-sprint',
            owner_type: 'session',
            owner_id: 'test-session-id',
            start_date: '2024-02-01',
            end_date: '2024-02-07',
            status: 'active',
          },
          error: null,
        });

      const request = new Request('http://localhost/api/detox', {
        method: 'POST',
        body: JSON.stringify({
          start_date: '2024-02-01',
          end_date: '2024-02-07',
          rules_json: {
            no_dining_out: true,
            no_shopping: true,
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-sprint');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_type: 'session',
          owner_id: 'test-session-id',
          start_date: '2024-02-01',
          end_date: '2024-02-07',
        })
      );
    });

    it('should return 400 when active sprint exists', async () => {
      // First call returns an existing active sprint
      mockSingle.mockResolvedValueOnce({
        data: { id: 'existing-active-sprint' },
        error: null,
      });

      const request = new Request('http://localhost/api/detox', {
        method: 'POST',
        body: JSON.stringify({
          start_date: '2024-02-01',
          end_date: '2024-02-07',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('You already have an active sprint');
    });

    it('should return 400 for missing start_date', async () => {
      const request = new Request('http://localhost/api/detox', {
        method: 'POST',
        body: JSON.stringify({
          end_date: '2024-02-07',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing end_date', async () => {
      const request = new Request('http://localhost/api/detox', {
        method: 'POST',
        body: JSON.stringify({
          start_date: '2024-02-01',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should accept null rules_json', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'sprint-no-rules',
            start_date: '2024-02-01',
            end_date: '2024-02-07',
            rules_json: null,
          },
          error: null,
        });

      const request = new Request('http://localhost/api/detox', {
        method: 'POST',
        body: JSON.stringify({
          start_date: '2024-02-01',
          end_date: '2024-02-07',
          rules_json: null,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should accept custom rules in rules_json', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: {
            id: 'sprint-custom-rules',
            rules_json: {
              custom_rules: ['No takeout', 'Pack lunch daily'],
            },
          },
          error: null,
        });

      const request = new Request('http://localhost/api/detox', {
        method: 'POST',
        body: JSON.stringify({
          start_date: '2024-02-01',
          end_date: '2024-02-07',
          rules_json: {
            custom_rules: ['No takeout', 'Pack lunch daily'],
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.rules_json.custom_rules).toContain('No takeout');
    });

    it('should return 500 when insert fails', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      const request = new Request('http://localhost/api/detox', {
        method: 'POST',
        body: JSON.stringify({
          start_date: '2024-02-01',
          end_date: '2024-02-07',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
