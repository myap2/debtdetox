export function formatCurrency(cents: number, options?: { compact?: boolean }): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    ...(options?.compact ? { maximumFractionDigits: 0 } : {}),
  }).format(cents / 100);
}

export function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatMonthYear(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function formatFullDate(date: Date | string): string {
  // Date-only strings (YYYY-MM-DD) are parsed as UTC; render them as UTC so
  // the calendar date the user picked doesn't shift with their timezone.
  const isDateOnly = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(isDateOnly ? { timeZone: 'UTC' } : {}),
  });
}

export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const then = new Date(date).getTime();
  const seconds = Math.round((now.getTime() - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatFullDate(date);
}

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayISODate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
