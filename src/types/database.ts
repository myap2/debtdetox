export type OwnerType = 'session' | 'user';

export type DebtType =
  | 'credit_card'
  | 'student_loan'
  | 'mortgage'
  | 'auto'
  | 'personal'
  | 'medical'
  | 'other';

export type PayoffStrategy = 'snowball' | 'avalanche' | 'custom';

export type SprintStatus = 'active' | 'completed' | 'abandoned';

export type InvestmentType =
  | 'stocks'
  | 'bonds'
  | 'retirement_401k'
  | 'retirement_ira'
  | 'real_estate'
  | 'savings'
  | 'crypto'
  | 'custom';

export type TaxStatus = 'taxable' | 'tax_deferred' | 'tax_free';

export interface Session {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  merged_into_user_id: string | null;
}

export interface Debt {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  name: string;
  type: DebtType;
  balance_cents: number;
  apr_bps: number; // basis points (500 = 5.00%)
  min_payment_cents: number;
  due_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  name: string;
  strategy: PayoffStrategy;
  extra_payment_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Full data captured when a plan is saved, stored in plan_snapshots.snapshot_json.
// Dates are ISO strings because the snapshot round-trips through JSONB.
export interface PlanSnapshotData {
  strategy: PayoffStrategy;
  extra_payment_cents: number;
  debts: (DebtInput & { type: DebtType })[];
  result: {
    schedule: SerializedMonthlyBreakdown[];
    total_interest_cents: number;
    total_paid_cents: number;
    debt_free_date: string;
    months_to_payoff: number;
    debts_payoff_order: { id: string; name: string; payoff_month: number }[];
  };
  comparison: {
    snowball_interest_cents: number;
    avalanche_interest_cents: number;
    snowball_months: number;
    avalanche_months: number;
    savings_cents: number;
    faster_strategy: PayoffStrategy;
    months_saved: number;
  };
}

export interface SerializedMonthlyBreakdown {
  month: number;
  date: string;
  payments: MonthlyPayment[];
  total_payment_cents: number;
  total_remaining_cents: number;
}

export interface PlanSnapshot {
  id: string;
  plan_id: string;
  snapshot_json: PlanSnapshotData;
  total_interest_cents: number;
  debt_free_date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  debt_id: string;
  amount_cents: number;
  balance_delta_cents: number;
  note: string | null;
  paid_at: string;
  created_at: string;
}

export type ActivityEventType =
  | 'debt_added'
  | 'debt_updated'
  | 'debt_deleted'
  | 'payment_recorded'
  | 'payment_updated'
  | 'payment_deleted'
  | 'sprint_started'
  | 'sprint_completed'
  | 'sprint_abandoned'
  | 'badge_earned'
  | 'investment_saved'
  | 'investment_deleted'
  | 'plan_saved'
  | 'plan_deleted';

export interface ActivityEvent {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  event_type: ActivityEventType;
  metadata: Record<string, string | number | boolean | null> | null;
  created_at: string;
}

export interface DetoxSprint {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  start_date: string;
  end_date: string;
  rules_json: DetoxRules | null;
  status: SprintStatus;
  created_at: string;
}

export interface DetoxWin {
  id: string;
  sprint_id: string;
  description: string;
  amount_saved_cents: number | null;
  logged_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_reminders: boolean;
  reminder_days_before: number;
  weekly_summary: boolean;
  monthly_report: boolean;
  detox_reminders: boolean;
  milestone_alerts: boolean;
  created_at: string;
  updated_at: string;
}

export interface Investment {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  name: string;
  type: InvestmentType;
  initial_balance_cents: number;
  monthly_contribution_cents: number;
  annual_return_bps: number; // basis points (700 = 7.00%)
  tax_status: TaxStatus;
  tax_rate_bps: number; // basis points (2500 = 25%)
  inflation_rate_bps: number; // basis points (300 = 3%)
  target_amount_cents: number | null;
  target_years: number | null;
  created_at: string;
  updated_at: string;
}

// Payoff Engine Types
export interface DebtInput {
  id: string;
  name: string;
  balance_cents: number;
  apr_bps: number;
  min_payment_cents: number;
}

export interface MonthlyPayment {
  debt_id: string;
  debt_name: string;
  payment_cents: number;
  principal_cents: number;
  interest_cents: number;
  remaining_balance_cents: number;
}

export interface MonthlyBreakdown {
  month: number;
  date: Date;
  payments: MonthlyPayment[];
  total_payment_cents: number;
  total_remaining_cents: number;
}

export interface PayoffSchedule {
  schedule: MonthlyBreakdown[];
  total_interest_cents: number;
  debt_free_date: Date;
  months_to_payoff: number;
}

export interface DetoxRules {
  no_dining_out?: boolean;
  no_subscriptions?: boolean;
  no_entertainment?: boolean;
  no_shopping?: boolean;
  custom_rules?: string[];
}

// Database Row Types (for Supabase)
export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at' | 'last_seen_at' | 'expires_at'> & {
          id?: string;
          created_at?: string;
          last_seen_at?: string;
          expires_at?: string;
        };
        Update: Partial<Session>;
      };
      debts: {
        Row: Debt;
        Insert: Omit<Debt, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Debt, 'id' | 'created_at'>>;
      };
      plans: {
        Row: Plan;
        Insert: Omit<Plan, 'id' | 'created_at' | 'updated_at' | 'is_active' | 'extra_payment_cents' | 'name'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          extra_payment_cents?: number;
          name?: string;
        };
        Update: Partial<Omit<Plan, 'id' | 'created_at'>>;
      };
      plan_snapshots: {
        Row: PlanSnapshot;
        Insert: Omit<PlanSnapshot, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PlanSnapshot, 'id' | 'created_at'>>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, 'id' | 'created_at' | 'note' | 'balance_delta_cents'> & {
          id?: string;
          created_at?: string;
          note?: string | null;
          balance_delta_cents?: number;
        };
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>;
      };
      detox_sprints: {
        Row: DetoxSprint;
        Insert: Omit<DetoxSprint, 'id' | 'created_at' | 'status'> & {
          id?: string;
          created_at?: string;
          status?: SprintStatus;
        };
        Update: Partial<Omit<DetoxSprint, 'id' | 'created_at'>>;
      };
      detox_wins: {
        Row: DetoxWin;
        Insert: Omit<DetoxWin, 'id' | 'logged_at'> & {
          id?: string;
          logged_at?: string;
        };
        Update: Partial<Omit<DetoxWin, 'id'>>;
      };
      notification_preferences: {
        Row: NotificationPreferences;
        Insert: Pick<NotificationPreferences, 'user_id'> &
          Partial<Omit<NotificationPreferences, 'user_id'>>;
        Update: Partial<Omit<NotificationPreferences, 'id' | 'created_at'>>;
      };
      investments: {
        Row: Investment;
        Insert: Omit<Investment, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Investment, 'id' | 'created_at'>>;
      };
      activity_events: {
        Row: ActivityEvent;
        Insert: Omit<ActivityEvent, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ActivityEvent, 'id' | 'created_at'>>;
      };
    };
  };
}
