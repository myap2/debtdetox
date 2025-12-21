import type { DetoxSprint, DetoxWin } from '@/types/database';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: 'trophy' | 'flame' | 'star' | 'zap' | 'target' | 'crown' | 'medal';
  tier: 'bronze' | 'silver' | 'gold';
  earnedAt?: Date;
}

interface SprintWithWins extends DetoxSprint {
  detox_wins: DetoxWin[];
}

export function calculateBadges(sprints: SprintWithWins[]): Badge[] {
  const badges: Badge[] = [];
  const completedSprints = sprints.filter((s) => s.status === 'completed');
  const totalWins = sprints.reduce(
    (sum, s) => sum + (s.detox_wins?.length ?? 0),
    0
  );
  const totalSaved = sprints.reduce(
    (sum, s) =>
      sum +
      (s.detox_wins?.reduce((w, win) => w + (win.amount_saved_cents ?? 0), 0) ??
        0),
    0
  );

  // First Sprint Badge
  if (completedSprints.length >= 1) {
    badges.push({
      id: 'first-sprint',
      name: 'First Steps',
      description: 'Completed your first detox sprint',
      icon: 'star',
      tier: 'bronze',
      earnedAt: new Date(completedSprints[0].end_date),
    });
  }

  // Sprint Count Badges
  if (completedSprints.length >= 3) {
    badges.push({
      id: 'sprint-streak-3',
      name: 'Hat Trick',
      description: 'Completed 3 detox sprints',
      icon: 'flame',
      tier: 'bronze',
    });
  }

  if (completedSprints.length >= 5) {
    badges.push({
      id: 'sprint-streak-5',
      name: 'High Five',
      description: 'Completed 5 detox sprints',
      icon: 'flame',
      tier: 'silver',
    });
  }

  if (completedSprints.length >= 10) {
    badges.push({
      id: 'sprint-streak-10',
      name: 'Detox Master',
      description: 'Completed 10 detox sprints',
      icon: 'crown',
      tier: 'gold',
    });
  }

  // Win Count Badges
  if (totalWins >= 5) {
    badges.push({
      id: 'wins-5',
      name: 'Winner',
      description: 'Logged 5 wins',
      icon: 'trophy',
      tier: 'bronze',
    });
  }

  if (totalWins >= 25) {
    badges.push({
      id: 'wins-25',
      name: 'Champion',
      description: 'Logged 25 wins',
      icon: 'trophy',
      tier: 'silver',
    });
  }

  if (totalWins >= 100) {
    badges.push({
      id: 'wins-100',
      name: 'Legend',
      description: 'Logged 100 wins',
      icon: 'trophy',
      tier: 'gold',
    });
  }

  // Savings Badges
  if (totalSaved >= 10000) {
    // $100
    badges.push({
      id: 'saved-100',
      name: 'Saver',
      description: 'Saved $100 through detox sprints',
      icon: 'target',
      tier: 'bronze',
    });
  }

  if (totalSaved >= 50000) {
    // $500
    badges.push({
      id: 'saved-500',
      name: 'Super Saver',
      description: 'Saved $500 through detox sprints',
      icon: 'target',
      tier: 'silver',
    });
  }

  if (totalSaved >= 100000) {
    // $1000
    badges.push({
      id: 'saved-1000',
      name: 'Money Master',
      description: 'Saved $1,000 through detox sprints',
      icon: 'target',
      tier: 'gold',
    });
  }

  // Perfect Sprint (no abandoned sprints)
  const abandonedCount = sprints.filter((s) => s.status === 'abandoned').length;
  if (completedSprints.length >= 3 && abandonedCount === 0) {
    badges.push({
      id: 'perfect-record',
      name: 'Perfect Record',
      description: 'Completed 3+ sprints without abandoning any',
      icon: 'medal',
      tier: 'gold',
    });
  }

  // Long Sprint (30+ days)
  const longSprints = completedSprints.filter((s) => {
    const start = new Date(s.start_date);
    const end = new Date(s.end_date);
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return days >= 30;
  });

  if (longSprints.length >= 1) {
    badges.push({
      id: 'marathon',
      name: 'Marathon Runner',
      description: 'Completed a 30+ day sprint',
      icon: 'zap',
      tier: 'silver',
    });
  }

  return badges;
}

export function calculateStreak(sprints: SprintWithWins[]): number {
  const completedSprints = sprints
    .filter((s) => s.status === 'completed')
    .sort(
      (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
    );

  if (completedSprints.length === 0) return 0;

  let streak = 0;
  let lastEndDate: Date | null = null;

  for (const sprint of completedSprints) {
    const endDate = new Date(sprint.end_date);

    if (lastEndDate === null) {
      // Check if the most recent sprint ended within the last 14 days
      const daysSinceEnd = Math.ceil(
        (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceEnd > 14) break; // Streak is broken
      streak = 1;
      lastEndDate = endDate;
    } else {
      // Check if this sprint ended within 14 days before the last one started
      const startDate = new Date(sprint.start_date);
      const daysBetween = Math.ceil(
        (lastEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysBetween <= 14) {
        streak++;
        lastEndDate = endDate;
      } else {
        break; // Gap too large, streak is broken
      }
    }
  }

  return streak;
}
