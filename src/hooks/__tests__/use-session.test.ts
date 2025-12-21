import { renderHook, waitFor, act } from '@testing-library/react';
import { useSession } from '../use-session';

// Mock auth state change callback
let authStateCallback: ((event: string, session: unknown) => void) | null = null;

const mockGetUser = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        authStateCallback = callback;
        mockOnAuthStateChange(callback);
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        };
      },
    },
  }),
}));

describe('useSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;
  });

  it('should start in loading state', () => {
    mockGetUser.mockReturnValue(new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useSession());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should return unauthenticated state when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should return authenticated state when user exists', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should listen for auth state changes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it('should update when auth state changes to signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);

    // Simulate auth state change
    const newUser = { id: 'new-user', email: 'new@example.com' };
    act(() => {
      authStateCallback?.('SIGNED_IN', { user: newUser });
    });

    expect(result.current.user).toEqual(newUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should update when auth state changes to signed out', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Simulate sign out
    act(() => {
      authStateCallback?.('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should unsubscribe on unmount', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { unmount } = renderHook(() => useSession());

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
