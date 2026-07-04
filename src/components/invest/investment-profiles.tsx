'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Copy, Trash, Plus, Upload, LineChart } from 'lucide-react';
import { toast } from 'sonner';
import { InvestmentProfileDialog } from './investment-profile-dialog';
import { useInvestments, useCreateInvestment } from '@/hooks/use-investments';
import { useUndoableDelete } from '@/hooks/use-undoable-delete';
import { formatCurrency, formatPercent } from '@/lib/format';
import type { Investment, InvestmentType } from '@/types/database';

const investmentTypeLabels: Record<InvestmentType, string> = {
  stocks: 'Stocks',
  bonds: 'Bonds',
  retirement_401k: '401(k)',
  retirement_ira: 'IRA',
  real_estate: 'Real Estate',
  savings: 'Savings',
  crypto: 'Crypto',
  custom: 'Custom',
};

async function deleteInvestmentRequest(investment: Investment) {
  const response = await fetch(`/api/investments/${investment.id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete profile');
  }
}

interface InvestmentProfilesProps {
  onLoad: (profile: Investment) => void;
}

export function InvestmentProfiles({ onLoad }: InvestmentProfilesProps) {
  const { data: profiles = [], isLoading } = useInvestments();
  const createInvestment = useCreateInvestment();
  const [creating, setCreating] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Investment | null>(null);

  const { deleteWithUndo } = useUndoableDelete<Investment>({
    queryKey: ['investments'],
    getId: (profile) => profile.id,
    deleteFn: deleteInvestmentRequest,
    invalidateKeys: [['activity']],
    entityLabel: 'profile',
  });

  async function handleDuplicate(profile: Investment) {
    try {
      await createInvestment.mutateAsync({
        name: `${profile.name} (copy)`,
        type: profile.type,
        initial_balance_cents: profile.initial_balance_cents,
        monthly_contribution_cents: profile.monthly_contribution_cents,
        annual_return_bps: profile.annual_return_bps,
        tax_status: profile.tax_status,
        tax_rate_bps: profile.tax_rate_bps,
        inflation_rate_bps: profile.inflation_rate_bps,
        target_amount_cents: profile.target_amount_cents,
        target_years: profile.target_years,
      });
      toast.success(`Duplicated "${profile.name}"`);
    } catch {
      toast.error('Failed to duplicate profile');
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Saved Profiles</h2>
          <p className="text-sm text-muted-foreground">
            Investment scenarios you can reload into the calculator
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create New
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <LineChart className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">No saved profiles yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Save your calculator inputs as a profile, or create one from scratch.
            </p>
            <Button className="mt-4" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{profile.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary" className="mt-1">
                        {investmentTypeLabels[profile.type]}
                      </Badge>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-2 -mt-1 shrink-0"
                        aria-label={`Actions for ${profile.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onLoad(profile)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Load into Calculator
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingProfile(profile)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(profile)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteWithUndo(profile)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Expected return</dt>
                    <dd className="font-medium">{formatPercent(profile.annual_return_bps)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Tax rate</dt>
                    <dd className="font-medium">{formatPercent(profile.tax_rate_bps)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Inflation rate</dt>
                    <dd className="font-medium">{formatPercent(profile.inflation_rate_bps)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Starting amount</dt>
                    <dd className="font-medium">
                      {formatCurrency(profile.initial_balance_cents, { compact: true })}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Monthly contribution</dt>
                    <dd className="font-medium">
                      {formatCurrency(profile.monthly_contribution_cents, { compact: true })}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Time horizon</dt>
                    <dd className="font-medium">
                      {profile.target_years ? `${profile.target_years} years` : '--'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => onLoad(profile)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Load
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <InvestmentProfileDialog open={creating} onOpenChange={setCreating} />
      <InvestmentProfileDialog
        open={!!editingProfile}
        onOpenChange={(open) => !open && setEditingProfile(null)}
        profile={editingProfile}
        onSuccess={() => setEditingProfile(null)}
      />
    </div>
  );
}
