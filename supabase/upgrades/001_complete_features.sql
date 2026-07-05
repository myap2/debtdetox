-- Migration: complete payment logging, saved plans, notification preferences, and activity log
-- Run this in your Supabase SQL Editor if you already have an existing database.
-- (New installs can run schema.sql instead, which includes all of this.)

-- Payments: optional note + the exact amount the debt balance was reduced by.
-- balance_delta_cents lets edits/deletes restore balances exactly, even for
-- confirmed overpayments where only part of the amount applied to the balance.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS balance_delta_cents BIGINT NOT NULL DEFAULT 0;
UPDATE payments SET balance_delta_cents = amount_cents WHERE balance_delta_cents = 0;

CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);

DO $$ BEGIN
  CREATE POLICY "Payments can be updated by owner" ON payments
    FOR UPDATE USING (
      (owner_type = 'user' AND owner_id = auth.uid()) OR
      (owner_type = 'session')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Plans: user-facing name for saved plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled Plan';

DO $$ BEGIN
  CREATE POLICY "Plan snapshots can be deleted by plan owner" ON plan_snapshots
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM plans WHERE plans.id = plan_snapshots.plan_id
        AND ((plans.owner_type = 'user' AND plans.owner_id = auth.uid()) OR plans.owner_type = 'session')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification preferences: additional toggles
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS monthly_report BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS detox_reminders BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS milestone_alerts BOOLEAN DEFAULT true;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
  CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Activity events
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'debt_added', 'debt_updated', 'debt_deleted',
    'payment_recorded', 'payment_updated', 'payment_deleted',
    'sprint_started', 'sprint_completed', 'sprint_abandoned',
    'badge_earned',
    'investment_saved', 'investment_deleted',
    'plan_saved', 'plan_deleted'
  )),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_owner ON activity_events(owner_type, owner_id, created_at DESC);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Activity events are viewable by owner" ON activity_events
    FOR SELECT USING (
      (owner_type = 'user' AND owner_id = auth.uid()) OR
      (owner_type = 'session')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Activity events can be created" ON activity_events
    FOR INSERT WITH CHECK (
      (owner_type = 'user' AND owner_id = auth.uid()) OR
      (owner_type = 'session')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Activity events can be deleted by owner" ON activity_events
    FOR DELETE USING (
      (owner_type = 'user' AND owner_id = auth.uid()) OR
      (owner_type = 'session')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Activity events can be updated by owner" ON activity_events
    FOR UPDATE USING (
      (owner_type = 'user' AND owner_id = auth.uid()) OR
      (owner_type = 'session')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
