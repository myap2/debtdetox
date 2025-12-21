/**
 * @jest-environment node
 */

import { GET, DELETE } from '../route';

// Mock cookies
const mockCookieDelete = jest.fn();
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    delete: (...args: unknown[]) => mockCookieDelete(...args),
  }),
}));

// Mock session module
const mockGetOrCreateSession = jest.fn();
jest.mock('@/lib/session', () => ({
  getOrCreateSession: () => mockGetOrCreateSession(),
}));

// Mock Supabase
const mockAuthGetUser = jest.fn();
const mockAuthSignOut = jest.fn();
const mockFrom = jest.fn();
const mockDelete = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockAuthGetUser(),
      signOut: () => mockAuthSignOut(),
    },
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (cols: string, opts?: unknown) => {
          mockSelect(cols, opts);
          return {
            eq: (col: string, val: unknown) => {
              mockEq(col, val);
              return {
                eq: (col2: string, val2: unknown) => {
                  mockEq(col2, val2);
                  // Return different counts based on table
                  if (table === 'debts') {
                    return Promise.resolve({ data: [], count: 5, error: null });
                  } else if (table === 'detox_sprints') {
                    return Promise.resolve({ data: [], count: 2, error: null });
                  }
                  return Promise.resolve({ data: [], count: 0, error: null });
                },
              };
            },
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: (col: string, val: unknown) => {
              mockEq(col, val);
              return {
                eq: (col2: string, val2: unknown) => {
                  mockEq(col2, val2);
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  }),
}));

describe('/api/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/me', () => {
    it('should return session info for anonymous user', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'session',
        id: 'anon-session-123',
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session_type).toBe('session');
      expect(data.session_id).toBe('anon-session-123');
      expect(data.user).toBeNull();
    });

    it('should return user info for authenticated user', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'user',
        id: 'user-456',
      });

      mockAuthGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-456',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session_type).toBe('user');
      expect(data.user).not.toBeNull();
      expect(data.user.email).toBe('test@example.com');
    });

    it('should return stats for debts and sprints', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'session',
        id: 'session-789',
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.debts_count).toBe(5);
      expect(data.stats.sprints_count).toBe(2);
    });

    it('should query correct tables for stats', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'session',
        id: 'session-abc',
      });

      await GET();

      expect(mockFrom).toHaveBeenCalledWith('debts');
      expect(mockFrom).toHaveBeenCalledWith('detox_sprints');
      expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact' });
    });

    it('should return 500 on error', async () => {
      mockGetOrCreateSession.mockRejectedValue(new Error('Session error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('DELETE /api/me', () => {
    it('should delete all data for anonymous session', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'session',
        id: 'session-to-delete',
      });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('All data deleted');

      // Should delete from all tables
      expect(mockFrom).toHaveBeenCalledWith('detox_sprints');
      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(mockFrom).toHaveBeenCalledWith('plans');
      expect(mockFrom).toHaveBeenCalledWith('debts');
      expect(mockFrom).toHaveBeenCalledWith('sessions');
    });

    it('should delete session cookie for anonymous user', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'session',
        id: 'session-to-delete',
      });

      await DELETE();

      expect(mockCookieDelete).toHaveBeenCalledWith('debtdetox_session_id');
    });

    it('should sign out authenticated user', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'user',
        id: 'user-to-delete',
      });

      await DELETE();

      expect(mockAuthSignOut).toHaveBeenCalled();
      // Should NOT delete cookie for authenticated users
      expect(mockCookieDelete).not.toHaveBeenCalled();
    });

    it('should delete data in correct order (foreign key constraints)', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'session',
        id: 'session-xyz',
      });

      await DELETE();

      // Check order of deletions
      const calls = mockFrom.mock.calls.map(call => call[0]);
      const sprintsIndex = calls.indexOf('detox_sprints');
      const paymentsIndex = calls.indexOf('payments');
      const plansIndex = calls.indexOf('plans');
      const debtsIndex = calls.indexOf('debts');

      // Sprints should be deleted before debts (due to potential foreign keys)
      expect(sprintsIndex).toBeLessThan(debtsIndex);
      expect(plansIndex).toBeLessThan(debtsIndex);
    });

    it('should return 500 on delete error', async () => {
      mockGetOrCreateSession.mockRejectedValue(new Error('Delete error'));

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete data');
    });
  });
});
