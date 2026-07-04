/**
 * @jest-environment node
 */

import { GET, PATCH } from '../preferences/route';
import { NextRequest } from 'next/server';
import { createMockSupabase, type MockSupabaseState } from '@/test/supabase-mock';

let state: MockSupabaseState;

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(createMockSupabase(state))),
}));

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

describe('Notification Preferences API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state = {
      tables: { notification_preferences: [] },
      user: { id: 'user-1', email: 'test@example.com' },
    };
  });

  describe('GET /api/notifications/preferences', () => {
    it('should return 401 for anonymous sessions', async () => {
      state.user = null;

      const response = await GET();

      expect(response.status).toBe(401);
    });

    it('should return defaults when the user has no saved preferences', async () => {
      const response = await GET();
      const preferences = await response.json();

      expect(response.status).toBe(200);
      expect(preferences).toMatchObject({
        user_id: 'user-1',
        email_reminders: true,
        weekly_summary: true,
        monthly_report: true,
        detox_reminders: true,
        milestone_alerts: true,
      });
    });

    it('should return the saved row when it exists', async () => {
      state.tables.notification_preferences = [
        {
          id: 'pref-1',
          user_id: 'user-1',
          email_reminders: false,
          reminder_days_before: 3,
          weekly_summary: true,
          monthly_report: false,
          detox_reminders: true,
          milestone_alerts: true,
        },
      ];

      const response = await GET();
      const preferences = await response.json();

      expect(preferences.email_reminders).toBe(false);
      expect(preferences.monthly_report).toBe(false);
    });
  });

  describe('PATCH /api/notifications/preferences', () => {
    it('should return 401 for anonymous sessions', async () => {
      state.user = null;

      const response = await PATCH(patchRequest({ weekly_summary: false }));

      expect(response.status).toBe(401);
    });

    it('should create the row on first change', async () => {
      const response = await PATCH(patchRequest({ weekly_summary: false }));
      const preferences = await response.json();

      expect(response.status).toBe(200);
      expect(preferences.weekly_summary).toBe(false);
      expect(state.tables.notification_preferences).toHaveLength(1);
    });

    it('should update the existing row on later changes', async () => {
      await PATCH(patchRequest({ weekly_summary: false }));
      const response = await PATCH(patchRequest({ milestone_alerts: false }));
      const preferences = await response.json();

      expect(response.status).toBe(200);
      expect(preferences.milestone_alerts).toBe(false);
      expect(preferences.weekly_summary).toBe(false);
      expect(state.tables.notification_preferences).toHaveLength(1);
    });

    it('should reject unknown values', async () => {
      const response = await PATCH(patchRequest({ reminder_days_before: 99 }));

      expect(response.status).toBe(400);
    });
  });
});
