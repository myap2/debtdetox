'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CreditCard,
  Target,
  Flame,
  TrendingUp,
  Settings,
  LogOut,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSession } from '@/hooks/use-session';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/debts', label: 'Debts', icon: CreditCard },
  { href: '/plan', label: 'Payoff Plan', icon: Target },
  { href: '/invest', label: 'Invest', icon: TrendingUp },
  { href: '/detox', label: 'Detox Sprint', icon: Flame },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useSession();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="text-xl font-bold text-sidebar-foreground">
          DebtDetox
        </Link>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="p-4 space-y-2">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>

        {!isLoading && (
          isAuthenticated ? (
            <div className="space-y-2">
              <p className="px-3 text-xs text-sidebar-foreground/60 truncate">
                {user?.email}
              </p>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="ghost" className="w-full justify-start gap-3 px-3">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )
        )}
      </div>
    </aside>
  );
}
