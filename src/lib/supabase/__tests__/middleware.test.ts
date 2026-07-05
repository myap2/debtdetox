/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '../middleware';

const mockGetUser = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('updateSession', () => {
  const originalSkip = process.env.SKIP_SUPABASE_AUTH_REFRESH;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.SKIP_SUPABASE_AUTH_REFRESH;
  });

  afterAll(() => {
    if (originalSkip === undefined) {
      delete process.env.SKIP_SUPABASE_AUTH_REFRESH;
    } else {
      process.env.SKIP_SUPABASE_AUTH_REFRESH = originalSkip;
    }
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  it('skips Supabase auth refresh when smoke mode is enabled', async () => {
    process.env.SKIP_SUPABASE_AUTH_REFRESH = 'true';
    const request = new NextRequest('https://debtdetox.test/dashboard');

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('refreshes Supabase auth by default', async () => {
    const request = new NextRequest('https://debtdetox.test/dashboard');

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
