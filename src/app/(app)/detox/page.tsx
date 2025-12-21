'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Flame, Plus, Trophy, Calendar, DollarSign, CheckCircle2, XCircle, Award } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeDisplay, StreakDisplay } from '@/components/gamification';
import { calculateBadges, calculateStreak } from '@/lib/gamification';
import type { DetoxSprint, DetoxWin, DetoxRules } from '@/types/database';

interface SprintWithWins extends DetoxSprint {
  detox_wins: DetoxWin[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getDaysPassed(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function DetoxPage() {
  const [sprints, setSprints] = useState<SprintWithWins[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewSprintDialog, setShowNewSprintDialog] = useState(false);
  const [showLogWinDialog, setShowLogWinDialog] = useState(false);

  // New sprint form state
  const [sprintDays, setSprintDays] = useState('7');
  const [rules, setRules] = useState<DetoxRules>({
    no_dining_out: true,
    no_subscriptions: false,
    no_entertainment: false,
    no_shopping: false,
  });
  const [isStartingSprint, setIsStartingSprint] = useState(false);

  // Log win form state
  const [winDescription, setWinDescription] = useState('');
  const [winAmount, setWinAmount] = useState('');
  const [isSubmittingWin, setIsSubmittingWin] = useState(false);

  async function fetchSprints() {
    try {
      const response = await fetch('/api/detox');
      if (!response.ok) throw new Error('Failed to fetch sprints');
      const data = await response.json();
      setSprints(data);
    } catch (error) {
      toast.error('Failed to load sprints');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSprints();
  }, []);

  async function handleStartSprint() {
    if (isStartingSprint) return; // Prevent double-submit

    const days = parseInt(sprintDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      toast.error('Please enter a valid number of days (1-365)');
      return;
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    setIsStartingSprint(true);
    try {
      const response = await fetch('/api/detox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          rules_json: rules,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start sprint');
      }

      toast.success('Sprint started!');
      setShowNewSprintDialog(false);
      fetchSprints();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start sprint');
    } finally {
      setIsStartingSprint(false);
    }
  }

  async function handleLogWin() {
    if (isSubmittingWin) return; // Prevent double-submit

    const activeSprint = sprints.find((s) => s.status === 'active');
    if (!activeSprint) return;

    if (!winDescription.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setIsSubmittingWin(true);
    try {
      const response = await fetch(`/api/detox/${activeSprint.id}/wins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: winDescription.trim(),
          amount_saved_cents: winAmount ? Math.round(parseFloat(winAmount) * 100) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to log win');
      }

      toast.success('Win logged!');
      setShowLogWinDialog(false);
      setWinDescription('');
      setWinAmount('');
      fetchSprints();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to log win');
    } finally {
      setIsSubmittingWin(false);
    }
  }

  async function handleEndSprint(id: string, status: 'completed' | 'abandoned') {
    const confirmMessage = status === 'completed'
      ? 'Complete this sprint?'
      : 'Abandon this sprint? You can start a new one after.';

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/detox/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed to update sprint');

      toast.success(status === 'completed' ? 'Sprint completed!' : 'Sprint abandoned');
      fetchSprints();
    } catch (error) {
      toast.error('Failed to update sprint');
    }
  }

  const activeSprint = sprints.find((s) => s.status === 'active');
  const pastSprints = sprints.filter((s) => s.status !== 'active');
  const badges = calculateBadges(sprints);
  const streak = calculateStreak(sprints);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header
          title="Detox Sprint"
          description="Accelerate your debt payoff with focused spending freezes"
        />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              Loading...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Detox Sprint"
        description="Accelerate your debt payoff with focused spending freezes"
      />

      <div className="flex-1 p-6">
        {activeSprint ? (
          <div className="space-y-6">
            {/* Active Sprint Card */}
            <Card className="border-orange-200 dark:border-orange-900">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                      <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <CardTitle>Active Sprint</CardTitle>
                      <CardDescription>
                        {formatDate(activeSprint.start_date)} - {formatDate(activeSprint.end_date)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                    {getDaysRemaining(activeSprint.end_date)} days left
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Days In</p>
                      <p className="text-lg font-semibold">{getDaysPassed(activeSprint.start_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Wins Logged</p>
                      <p className="text-lg font-semibold">{activeSprint.detox_wins?.length ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Saved</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(
                          activeSprint.detox_wins?.reduce((sum, w) => sum + (w.amount_saved_cents ?? 0), 0) ?? 0
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rules */}
                {activeSprint.rules_json && (
                  <div>
                    <p className="text-sm font-medium mb-2">Active Rules</p>
                    <div className="flex flex-wrap gap-2">
                      {activeSprint.rules_json.no_dining_out && <Badge variant="outline">No Dining Out</Badge>}
                      {activeSprint.rules_json.no_subscriptions && <Badge variant="outline">No New Subscriptions</Badge>}
                      {activeSprint.rules_json.no_entertainment && <Badge variant="outline">No Entertainment Spending</Badge>}
                      {activeSprint.rules_json.no_shopping && <Badge variant="outline">No Shopping</Badge>}
                    </div>
                  </div>
                )}

                {/* Recent Wins */}
                {activeSprint.detox_wins && activeSprint.detox_wins.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recent Wins</p>
                    <div className="space-y-2">
                      {activeSprint.detox_wins.slice(0, 5).map((win) => (
                        <div key={win.id} className="flex items-center justify-between rounded-lg border p-3">
                          <span className="text-sm">{win.description}</span>
                          {win.amount_saved_cents && (
                            <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                              +{formatCurrency(win.amount_saved_cents)}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => setShowLogWinDialog(true)}>
                    <Trophy className="mr-2 h-4 w-4" />
                    Log a Win
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleEndSprint(activeSprint.id, 'completed')}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Sprint
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleEndSprint(activeSprint.id, 'abandoned')}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Abandon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* No Active Sprint */
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="mt-4">Start a Detox Sprint</CardTitle>
              <CardDescription>
                Challenge yourself to cut unnecessary spending and put that money toward debt.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="mx-auto max-w-md space-y-4">
                <p className="text-sm text-muted-foreground">
                  A detox sprint is a focused period where you commit to eliminating non-essential spending.
                  Log your &quot;wins&quot; along the way and see how much extra you can put toward debt.
                </p>
                <Button onClick={() => setShowNewSprintDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start New Sprint
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gamification Section */}
        {(badges.length > 0 || streak > 0) && (
          <div className="mt-6 space-y-4">
            {streak > 0 && <StreakDisplay streak={streak} />}
            {badges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Your Badges
                  </CardTitle>
                  <CardDescription>
                    Achievements earned from your detox journey
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BadgeDisplay badges={badges} />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Past Sprints */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Past Sprints</h2>
          <p className="text-sm text-muted-foreground">
            Your completed and abandoned sprints
          </p>
          {pastSprints.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No past sprints yet
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {pastSprints.map((sprint) => (
                <Card key={sprint.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                        </span>
                        <Badge variant={sprint.status === 'completed' ? 'default' : 'secondary'}>
                          {sprint.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {sprint.detox_wins?.length ?? 0} wins logged
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(
                          sprint.detox_wins?.reduce((sum, w) => sum + (w.amount_saved_cents ?? 0), 0) ?? 0
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">saved</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Sprint Dialog */}
      <Dialog open={showNewSprintDialog} onOpenChange={setShowNewSprintDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a New Sprint</DialogTitle>
            <DialogDescription>
              Choose your sprint duration and rules
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="days">Sprint Duration (days)</Label>
              <Input
                id="days"
                type="number"
                min="1"
                max="365"
                value={sprintDays}
                onChange={(e) => setSprintDays(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Rules (optional)</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="no_dining"
                    checked={rules.no_dining_out}
                    onCheckedChange={(checked) =>
                      setRules((r) => ({ ...r, no_dining_out: !!checked }))
                    }
                  />
                  <Label htmlFor="no_dining" className="font-normal">
                    No dining out
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="no_subs"
                    checked={rules.no_subscriptions}
                    onCheckedChange={(checked) =>
                      setRules((r) => ({ ...r, no_subscriptions: !!checked }))
                    }
                  />
                  <Label htmlFor="no_subs" className="font-normal">
                    No new subscriptions
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="no_ent"
                    checked={rules.no_entertainment}
                    onCheckedChange={(checked) =>
                      setRules((r) => ({ ...r, no_entertainment: !!checked }))
                    }
                  />
                  <Label htmlFor="no_ent" className="font-normal">
                    No entertainment spending
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="no_shop"
                    checked={rules.no_shopping}
                    onCheckedChange={(checked) =>
                      setRules((r) => ({ ...r, no_shopping: !!checked }))
                    }
                  />
                  <Label htmlFor="no_shop" className="font-normal">
                    No non-essential shopping
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSprintDialog(false)} disabled={isStartingSprint}>
              Cancel
            </Button>
            <Button onClick={handleStartSprint} disabled={isStartingSprint}>
              {isStartingSprint ? 'Starting...' : 'Start Sprint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Win Dialog */}
      <Dialog open={showLogWinDialog} onOpenChange={setShowLogWinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a Win</DialogTitle>
            <DialogDescription>
              Record when you avoid an unnecessary expense
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="win_desc">What did you skip?</Label>
              <Input
                id="win_desc"
                placeholder="e.g., Skipped coffee shop, made at home"
                value={winDescription}
                onChange={(e) => setWinDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="win_amount">Amount Saved (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="win_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-7"
                  value={winAmount}
                  onChange={(e) => setWinAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogWinDialog(false)} disabled={isSubmittingWin}>
              Cancel
            </Button>
            <Button onClick={handleLogWin} disabled={isSubmittingWin}>
              {isSubmittingWin ? 'Logging...' : 'Log Win'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
