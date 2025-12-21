import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, Target, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            DebtDetox
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Button asChild>
              <Link href="/dashboard">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Take Control of Your Debt
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Track your debts, create a personalized payoff plan, and become debt-free faster
              with proven strategies like snowball and avalanche.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/dashboard">
                  Start Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="how-it-works" className="border-t bg-muted/50 py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold">How It Works</h2>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <TrendingDown className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">Add Your Debts</h3>
                <p className="mt-2 text-muted-foreground">
                  Enter your credit cards, loans, and other debts with their balances, interest rates, and minimum payments.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">Choose Your Strategy</h3>
                <p className="mt-2 text-muted-foreground">
                  Pick between snowball (smallest balance first) or avalanche (highest interest first) methods.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">Track Your Progress</h3>
                <p className="mt-2 text-muted-foreground">
                  See your debt-free date, track payments, and watch your balances shrink month by month.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold">Ready to Start Your Debt-Free Journey?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              No account required to get started. Your data is saved automatically.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href="/dashboard">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} DebtDetox. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
