'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  FolderOpen,
  Pencil,
  Copy,
  Trash,
  Target,
  CalendarDays,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useSavedPlans,
  useRenamePlan,
  useDuplicatePlan,
  type SavedPlanSummary,
} from '@/hooks/use-saved-plans';
import { useUndoableDelete } from '@/hooks/use-undoable-delete';
import { formatCurrency, formatFullDate, formatMonthYear } from '@/lib/format';

async function deletePlanRequest(plan: SavedPlanSummary) {
  const response = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete plan');
  }
}

export default function SavedPlansPage() {
  const { data: plans = [], isLoading } = useSavedPlans();
  const renamePlan = useRenamePlan();
  const duplicatePlan = useDuplicatePlan();
  const [renaming, setRenaming] = useState<SavedPlanSummary | null>(null);
  const [newName, setNewName] = useState('');

  const { deleteWithUndo } = useUndoableDelete<SavedPlanSummary>({
    queryKey: ['savedPlans'],
    getId: (plan) => plan.id,
    deleteFn: deletePlanRequest,
    invalidateKeys: [['activity']],
    entityLabel: 'plan',
  });

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    if (!renaming || !newName.trim()) return;

    try {
      await renamePlan.mutateAsync({ id: renaming.id, name: newName.trim() });
      toast.success('Plan renamed');
      setRenaming(null);
    } catch {
      toast.error('Failed to rename plan');
    }
  }

  async function handleDuplicate(plan: SavedPlanSummary) {
    try {
      await duplicatePlan.mutateAsync(plan.id);
      toast.success(`Duplicated "${plan.name}"`);
    } catch {
      toast.error('Failed to duplicate plan');
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Saved Plans"
        description="Payoff strategies you've saved to compare and revisit"
      />

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-10 w-10 text-muted-foreground" />
              <p className="mt-4 font-medium">No saved plans yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Build a payoff plan and save it to compare strategies over time.
              </p>
              <Button asChild className="mt-4">
                <Link href="/plan">Create a Plan</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{plan.name}</CardTitle>
                      <CardDescription>
                        Created {formatFullDate(plan.created_at)}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-mr-2 -mt-1 shrink-0"
                          aria-label={`Actions for ${plan.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/plans/${plan.id}`}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Open
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setRenaming(plan);
                            setNewName(plan.name);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(plan)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteWithUndo(plan)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="secondary" className="capitalize">
                      {plan.strategy}
                    </Badge>
                    {plan.extra_payment_cents > 0 && (
                      <Badge variant="outline">
                        +{formatCurrency(plan.extra_payment_cents, { compact: true })}/mo extra
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Debt-free date
                    </span>
                    <span className="font-medium">
                      {plan.debt_free_date ? formatMonthYear(plan.debt_free_date) : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <TrendingDown className="h-4 w-4" />
                      Interest paid
                    </span>
                    <span className="font-medium">
                      {plan.total_interest_cents !== null
                        ? formatCurrency(plan.total_interest_cents)
                        : '--'}
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/plans/${plan.id}`}>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Open Plan
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Plan</DialogTitle>
            <DialogDescription>Choose a new name for this plan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-plan">Plan Name</Label>
              <Input
                id="rename-plan"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={renamePlan.isPending || !newName.trim()}>
                {renamePlan.isPending ? 'Saving...' : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
