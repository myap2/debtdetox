'use client';

import { useSession } from '@/hooks/use-session';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const { isAuthenticated, isLoading } = useSession();

  return (
    <header className="border-b bg-background px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {!isLoading && !isAuthenticated && (
          <Badge variant="secondary">Anonymous Session</Badge>
        )}
      </div>
    </header>
  );
}
