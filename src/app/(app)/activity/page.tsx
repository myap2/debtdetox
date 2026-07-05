'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  CreditCard,
  Receipt,
  Flame,
  Award,
  TrendingUp,
  Bookmark,
  History,
  type LucideIcon,
} from 'lucide-react';
import { useActivity } from '@/hooks/use-activity';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import type { ActivityEvent, ActivityEventType } from '@/types/database';

interface EventDisplay {
  icon: LucideIcon;
  label: string;
  describe: (event: ActivityEvent) => string;
}

function metaString(event: ActivityEvent, key: string): string | null {
  const value = event.metadata?.[key];
  return typeof value === 'string' && value ? value : null;
}

function metaAmount(event: ActivityEvent): string | null {
  const value = event.metadata?.amount_cents;
  return typeof value === 'number' ? formatCurrency(value) : null;
}

const eventDisplays: Record<ActivityEventType, EventDisplay> = {
  debt_added: {
    icon: CreditCard,
    label: 'Debt Added',
    describe: (e) => `Added debt "${metaString(e, 'debt_name') ?? 'Unknown'}"`,
  },
  debt_updated: {
    icon: CreditCard,
    label: 'Debt Updated',
    describe: (e) => `Updated debt "${metaString(e, 'debt_name') ?? 'Unknown'}"`,
  },
  debt_deleted: {
    icon: CreditCard,
    label: 'Debt Deleted',
    describe: (e) => `Deleted debt "${metaString(e, 'debt_name') ?? 'Unknown'}"`,
  },
  payment_recorded: {
    icon: Receipt,
    label: 'Payment Recorded',
    describe: (e) => {
      const amount = metaAmount(e);
      const debt = metaString(e, 'debt_name');
      return `Recorded ${amount ?? 'a payment'}${debt ? ` toward ${debt}` : ''}`;
    },
  },
  payment_updated: {
    icon: Receipt,
    label: 'Payment Updated',
    describe: (e) => {
      const amount = metaAmount(e);
      const debt = metaString(e, 'debt_name');
      return `Updated a payment${amount ? ` to ${amount}` : ''}${debt ? ` on ${debt}` : ''}`;
    },
  },
  payment_deleted: {
    icon: Receipt,
    label: 'Payment Deleted',
    describe: (e) => {
      const amount = metaAmount(e);
      const debt = metaString(e, 'debt_name');
      return `Deleted a ${amount ?? ''} payment${debt ? ` on ${debt}` : ''}`.replace('  ', ' ');
    },
  },
  sprint_started: {
    icon: Flame,
    label: 'Sprint Started',
    describe: () => 'Started a detox sprint',
  },
  sprint_completed: {
    icon: Flame,
    label: 'Sprint Completed',
    describe: () => 'Completed a detox sprint',
  },
  sprint_abandoned: {
    icon: Flame,
    label: 'Sprint Abandoned',
    describe: () => 'Abandoned a detox sprint',
  },
  badge_earned: {
    icon: Award,
    label: 'Badge Earned',
    describe: (e) => `Earned the "${metaString(e, 'badge_name') ?? 'Unknown'}" badge`,
  },
  investment_saved: {
    icon: TrendingUp,
    label: 'Investment Profile Saved',
    describe: (e) =>
      `${e.metadata?.updated ? 'Updated' : 'Saved'} investment profile "${metaString(e, 'investment_name') ?? 'Unknown'}"`,
  },
  investment_deleted: {
    icon: TrendingUp,
    label: 'Investment Profile Deleted',
    describe: (e) =>
      `Deleted investment profile "${metaString(e, 'investment_name') ?? 'Unknown'}"`,
  },
  plan_saved: {
    icon: Bookmark,
    label: 'Plan Saved',
    describe: (e) => `Saved payoff plan "${metaString(e, 'plan_name') ?? 'Unknown'}"`,
  },
  plan_deleted: {
    icon: Bookmark,
    label: 'Plan Deleted',
    describe: (e) => `Deleted payoff plan "${metaString(e, 'plan_name') ?? 'Unknown'}"`,
  },
};

const filters: { value: string; label: string; types: ActivityEventType[] }[] = [
  { value: 'all', label: 'All Activity', types: [] },
  { value: 'debts', label: 'Debts', types: ['debt_added', 'debt_updated', 'debt_deleted'] },
  {
    value: 'payments',
    label: 'Payments',
    types: ['payment_recorded', 'payment_updated', 'payment_deleted'],
  },
  {
    value: 'sprints',
    label: 'Detox Sprints',
    types: ['sprint_started', 'sprint_completed', 'sprint_abandoned'],
  },
  { value: 'badges', label: 'Badges', types: ['badge_earned'] },
  {
    value: 'investments',
    label: 'Investments',
    types: ['investment_saved', 'investment_deleted'],
  },
  { value: 'plans', label: 'Saved Plans', types: ['plan_saved', 'plan_deleted'] },
];

export default function ActivityPage() {
  const [filter, setFilter] = useState('all');
  const activeTypes = useMemo(
    () => filters.find((f) => f.value === filter)?.types ?? [],
    [filter]
  );
  const { data: events = [], isLoading } = useActivity(activeTypes);

  return (
    <div className="flex flex-col">
      <Header title="Activity" description="A timeline of everything you've done" />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center justify-end gap-2">
          <Label htmlFor="activity-filter" className="text-muted-foreground">
            Show:
          </Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger id="activity-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filters.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-10 w-10 text-muted-foreground" />
              <p className="mt-4 font-medium">
                {filter === 'all' ? 'No activity yet' : 'No matching activity'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === 'all'
                  ? 'Actions like adding debts, recording payments, and earning badges will show up here.'
                  : 'Try a different filter to see more of your history.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border divide-y">
            {events.map((event) => {
              const display = eventDisplays[event.event_type];
              if (!display) return null;
              const Icon = display.icon;
              return (
                <div key={event.id} className="flex items-center gap-4 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{display.describe(event)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.created_at)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                    {display.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
