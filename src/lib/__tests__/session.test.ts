/**
 * @jest-environment node
 */

import { getOrCreateSession, getCurrentSession, mergeSessionToUser } from '../session';

// Mock cookies
const mockCookieGet = jest.fn();
const mockCookieSet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockCookieGet(...args),
    set: (...args: unknown[]) => mockCookieSet(...args),
  }),
}));

// Mock Supabase
const mockAuthGetUser = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockAuthGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (col: string, val: unknown) => {
              mockEq(col, val);
              return {
                single: () => mockSingle(),
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
        update: (data: unknown) => {
          mockUpdate(data);
          return {
            eq: (col: string, val: unknown) => {
              mockEq(col, val);
              return {
                eq: (col2: string, val2: unknown) => {
                  mockEq(col2, val2);
                  return Promise.resolve({ data: null, error: null });
                },
              };
            },
          };
        },
      };
    },
  }),
}));

describe('Session Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateSession', () => {
    it('should return user session when authenticated', async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const result = await getOrCreateSession();

      expect(result).toEqual({ type: 'user', id: 'user-123' });
    });

    it('should return existing anonymous session when valid', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue({ value: 'session-456' });

      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
      mockSingle.mockResolvedValue({
        data: {
          id: 'session-456',
          expires_at: futureDate,
          merged_into_user_id: null,
        },
        error: null,
      });

      const result = await getOrCreateSession();

      expect(result).toEqual({ type: 'session', id: 'session-456' });
      expect(mockUpdate).toHaveBeenCalled(); // last_seen_at update
    });

    it('should create new session when no valid session exists', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue(undefined);

      mockSingle.mockResolvedValue({
        data: { id: 'new-session-789' },
        error: null,
      });

      const result = await getOrCreateSession();

      expect(result).toEqual({ type: 'session', id: 'new-session-789' });
      expect(mockInsert).toHaveBeenCalledWith({});
      expect(mockCookieSet).toHaveBeenCalledWith(
        'debtdetox_session_id',
        'new-session-789',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        })
      );
    });

    it('should create new session when existing session is expired', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue({ value: 'expired-session' });

      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      mockSingle
        .mockResolvedValueOnce({
          data: {
            id: 'expired-session',
            expires_at: pastDate,
            merged_into_user_id: null,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'new-session-created' },
          error: null,
        });

      const result = await getOrCreateSession();

      expect(result).toEqual({ type: 'session', id: 'new-session-created' });
    });

    it('should create new session when existing session is merged', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue({ value: 'merged-session' });

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockSingle
        .mockResolvedValueOnce({
          data: {
            id: 'merged-session',
            expires_at: futureDate,
            merged_into_user_id: 'some-user-id', // Already merged
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'brand-new-session' },
          error: null,
        });

      const result = await getOrCreateSession();

      expect(result).toEqual({ type: 'session', id: 'brand-new-session' });
    });

    it('should throw error when session creation fails', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue(undefined);

      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(getOrCreateSession()).rejects.toThrow('Failed to create session');
    });
  });

  describe('getCurrentSession', () => {
    it('should return user session when authenticated', async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: 'user-abc' } },
      });

      const result = await getCurrentSession();

      expect(result).toEqual({ type: 'user', id: 'user-abc' });
    });

    it('should return null when no cookie exists', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue(undefined);

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });

    it('should return null when session is expired', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue({ value: 'expired-session' });

      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockSingle.mockResolvedValue({
        data: {
          id: 'expired-session',
          expires_at: pastDate,
          merged_into_user_id: null,
        },
        error: null,
      });

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });

    it('should return null when session is merged', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue({ value: 'merged-session' });

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockSingle.mockResolvedValue({
        data: {
          id: 'merged-session',
          expires_at: futureDate,
          merged_into_user_id: 'user-id',
        },
        error: null,
      });

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });

    it('should return session when valid', async () => {
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCookieGet.mockReturnValue({ value: 'valid-session' });

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockSingle.mockResolvedValue({
        data: {
          id: 'valid-session',
          expires_at: futureDate,
          merged_into_user_id: null,
        },
        error: null,
      });

      const result = await getCurrentSession();

      expect(result).toEqual({ type: 'session', id: 'valid-session' });
    });
  });

  describe('mergeSessionToUser', () => {
    it('should update all tables and mark session as merged', async () => {
      await mergeSessionToUser('session-to-merge', 'target-user-id');

      // Should update debts, plans, payments, detox_sprints
      expect(mockFrom).toHaveBeenCalledWith('debts');
      expect(mockFrom).toHaveBeenCalledWith('plans');
      expect(mockFrom).toHaveBeenCalledWith('payments');
      expect(mockFrom).toHaveBeenCalledWith('detox_sprints');
      expect(mockFrom).toHaveBeenCalledWith('sessions');

      // Should call update with the right data
      expect(mockUpdate).toHaveBeenCalledWith({
        owner_type: 'user',
        owner_id: 'target-user-id',
      });

      // Should mark session as merged
      expect(mockUpdate).toHaveBeenCalledWith({
        merged_into_user_id: 'target-user-id',
      });
    });
  });
});
