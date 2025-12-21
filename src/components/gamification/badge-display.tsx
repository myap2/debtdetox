'use client';

import { Trophy, Flame, Star, Zap, Target, Crown, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Badge } from '@/lib/gamification';

interface BadgeDisplayProps {
  badges: Badge[];
  compact?: boolean;
}

const iconMap = {
  trophy: Trophy,
  flame: Flame,
  star: Star,
  zap: Zap,
  target: Target,
  crown: Crown,
  medal: Medal,
};

const tierColors = {
  bronze: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
  },
  silver: {
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-600',
  },
  gold: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-400 dark:border-yellow-700',
  },
};

export function BadgeDisplay({ badges, compact = false }: BadgeDisplayProps) {
  if (badges.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {badges.slice(0, 5).map((badge) => {
          const Icon = iconMap[badge.icon];
          const colors = tierColors[badge.tier];

          return (
            <div
              key={badge.id}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2',
                colors.bg,
                colors.border
              )}
              title={`${badge.name}: ${badge.description}`}
            >
              <Icon className={cn('h-4 w-4', colors.text)} />
            </div>
          );
        })}
        {badges.length > 5 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted bg-muted text-xs font-medium">
            +{badges.length - 5}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {badges.map((badge) => {
        const Icon = iconMap[badge.icon];
        const colors = tierColors[badge.tier];

        return (
          <div
            key={badge.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-3',
              colors.bg,
              colors.border
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                colors.bg
              )}
            >
              <Icon className={cn('h-5 w-5', colors.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium text-sm', colors.text)}>
                {badge.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {badge.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
