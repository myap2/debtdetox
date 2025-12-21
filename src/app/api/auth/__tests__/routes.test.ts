/**
 * @jest-environment node
 */

import { GET as getSession } from '../session/route';
import { POST as postLogin } from '../login/route';
import { POST as postLogout } from '../logout/route';

// Mock session module
const mockGetOrCreateSession = jest.fn();
jest.mock('@/lib/session', () => ({
  getOrCreateSession: () => mockGetOrCreateSession(),
}));

// Mock Supabase
const mockSignInWithOtp = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      signInWithOtp: (opts: unknown) => mockSignInWithOtp(opts),
      signOut: () => mockSignOut(),
    },
  }),
}));

describe('Auth API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/session', () => {
    it('should return session info for anonymous user', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'session',
        id: 'anon-session-123',
      });

      const response = await getSession();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe('session');
      expect(data.id).toBe('anon-session-123');
    });

    it('should return session info for authenticated user', async () => {
      mockGetOrCreateSession.mockResolvedValue({
        type: 'user',
        id: 'user-456',
      });

      const response = await getSession();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.type).toBe('user');
      expect(data.id).toBe('user-456');
    });

    it('should return 500 when session creation fails', async () => {
      mockGetOrCreateSession.mockRejectedValue(new Error('Session error'));

      const response = await getSession();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create session');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should send magic link for valid email', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await postLogin(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Magic link sent!');
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        })
      );
    });

    it('should include redirect URL in OTP options', async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      const request = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      await postLogin(request);

      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: 'http://localhost:3000/api/auth/callback',
          }),
        })
      );
    });

    it('should return 400 for invalid email', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      const response = await postLogin(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid email');
    });

    it('should return 400 for missing email', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await postLogin(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when Supabase returns error', async () => {
      mockSignInWithOtp.mockResolvedValue({
        error: { message: 'Rate limited' },
      });

      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await postLogin(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Rate limited');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should sign out user', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const response = await postLogout();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Logged out');
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
