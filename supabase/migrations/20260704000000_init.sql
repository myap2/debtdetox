-- DebtDetox Database Schema
-- Run this in your Supabase SQL Editor

-- Sessions (for anonymous users)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  merged_into_user_id UUID REFERENCES auth.users(id)
);

-- Debts
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit_card', 'student_loan', 'mortgage', 'auto', 'personal', 'medical', 'other')),
  balance_cents BIGINT NOT NULL,
  apr_bps INTEGER NOT NULL,
  min_payment_cents BIGINT NOT NULL,
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Plan',
  strategy TEXT NOT NULL CHECK (strategy IN ('snowball', 'avalanche', 'custom')),
  extra_payment_cents BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan Snapshots (computed payoff schedules)
CREATE TABLE IF NOT EXISTS plan_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  snapshot_json JSONB NOT NULL,
  total_interest_cents BIGINT NOT NULL,
  debt_free_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (logged payments)
-- balance_delta_cents records exactly how much the debt balance was reduced,
-- so edits/deletes can restore balances precisely (overpayments only apply
-- up to the remaining balance).
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  balance_delta_cents BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  paid_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detox Sprints
CREATE TABLE IF NOT EXISTS detox_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rules_json JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detox Wins (logged achievements during sprint)
CREATE TABLE IF NOT EXISTS detox_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID REFERENCES detox_sprints(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_saved_cents BIGINT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Investments
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('session', 'user')),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('stocks', 'bonds', 'retirement_401k', 'retirement_ira', 'real_estate', 'savings', 'crypto', 'custom')),
  initial_balance_cents BIGINT NOT NULL DEFAULT 0,
  monthly_contribution_cents BIGINT NOT NULL DEFAULT 0,
  annual_return_bps INTEGER NOT NULL DEFAULT 700,
  tax_status TEXT NOT NULL DEFAULT 'taxable' CHECK (tax_status IN ('taxable', 'tax_deferred', 'tax_free')),
  tax_rate_bps INTEGER NOT NULL DEFAULT 2500,
  inflation_rate_bps INTEGER NOT NULL DEFAULT 300,
  target_amount_cents BIGINT,
  target_years INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_reminders BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,
  weekly_summary BOOLEAN DEFAULT true,
  monthly_report BOOLEAN DEFAULT true,
  detox_reminders BOOLEAN DEFAULT true,
  milestone_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Events (audit trail of user actions)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_debts_owner ON debts(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_plans_owner ON plans(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_owner ON payments(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_detox_sprints_owner ON detox_sprints(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_investments_owner ON investments(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_owner ON activity_events(owner_type, owner_id, created_at DESC);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE detox_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE detox_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Sessions are viewable by owner" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "Sessions can be created by anyone" ON sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Sessions can be updated by owner" ON sessions
  FOR UPDATE USING (true);

-- Debts policies
CREATE POLICY "Debts are viewable by owner" ON debts
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Debts can be created" ON debts
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Debts can be updated by owner" ON debts
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Debts can be deleted by owner" ON debts
  FOR DELETE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

-- Plans policies
CREATE POLICY "Plans are viewable by owner" ON plans
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Plans can be created" ON plans
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Plans can be updated by owner" ON plans
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Plans can be deleted by owner" ON plans
  FOR DELETE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

-- Plan Snapshots policies
CREATE POLICY "Plan snapshots are viewable by plan owner" ON plan_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plans WHERE plans.id = plan_snapshots.plan_id
      AND ((plans.owner_type = 'user' AND plans.owner_id = auth.uid()) OR plans.owner_type = 'session')
    )
  );

CREATE POLICY "Plan snapshots can be created" ON plan_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans WHERE plans.id = plan_snapshots.plan_id
      AND ((plans.owner_type = 'user' AND plans.owner_id = auth.uid()) OR plans.owner_type = 'session')
    )
  );

CREATE POLICY "Plan snapshots can be deleted by plan owner" ON plan_snapshots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM plans WHERE plans.id = plan_snapshots.plan_id
      AND ((plans.owner_type = 'user' AND plans.owner_id = auth.uid()) OR plans.owner_type = 'session')
    )
  );

-- Payments policies
CREATE POLICY "Payments are viewable by owner" ON payments
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Payments can be created" ON payments
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Payments can be updated by owner" ON payments
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Payments can be deleted by owner" ON payments
  FOR DELETE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

-- Detox Sprints policies
CREATE POLICY "Sprints are viewable by owner" ON detox_sprints
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Sprints can be created" ON detox_sprints
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Sprints can be updated by owner" ON detox_sprints
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

-- Detox Wins policies
CREATE POLICY "Wins are viewable by sprint owner" ON detox_wins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM detox_sprints WHERE detox_sprints.id = detox_wins.sprint_id
      AND ((detox_sprints.owner_type = 'user' AND detox_sprints.owner_id = auth.uid()) OR detox_sprints.owner_type = 'session')
    )
  );

CREATE POLICY "Wins can be created" ON detox_wins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM detox_sprints WHERE detox_sprints.id = detox_wins.sprint_id
      AND ((detox_sprints.owner_type = 'user' AND detox_sprints.owner_id = auth.uid()) OR detox_sprints.owner_type = 'session')
    )
  );

-- Investments policies
CREATE POLICY "Investments are viewable by owner" ON investments
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Investments can be created" ON investments
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Investments can be updated by owner" ON investments
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Investments can be deleted by owner" ON investments
  FOR DELETE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

-- Notification Preferences policies
CREATE POLICY "Notification prefs are viewable by owner" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Notification prefs can be created by owner" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Notification prefs can be updated by owner" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- Activity Events policies
CREATE POLICY "Activity events are viewable by owner" ON activity_events
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Activity events can be created" ON activity_events
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Activity events can be updated by owner" ON activity_events
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

CREATE POLICY "Activity events can be deleted by owner" ON activity_events
  FOR DELETE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'session')
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Explicit grants: cloud SQL-editor runs as postgres (default privileges apply
-- automatically), but local CLI migrations don't — grant the API roles access.
-- Row Level Security above remains the actual authorization layer.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
