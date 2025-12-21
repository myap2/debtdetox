'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakDisplayProps {
  streak: number;
  className?: string;
}

export function StreakDisplay({ streak, className }: StreakDisplayProps) {
  if (streak === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg bg-orange-100 px-3 py-2 dark:bg-orange-900/30',
        className
      )}
    >
      <Flame className="h-5 w-5 text-orange-500" />
      <div>
        <p className="text-sm font-bold text-orange-700 dark:text-orange-400">
          {streak} Sprint{streak > 1 ? 's' : ''} Streak!
        </p>
        <p className="text-xs text-orange-600/80 dark:text-orange-400/80">
          Keep it going!
        </p>
      </div>
    </div>
  );
}
