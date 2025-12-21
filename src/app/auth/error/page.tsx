import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Authentication Error</CardTitle>
          <CardDescription>
            Something went wrong during sign in
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>The magic link may have expired or already been used.</p>
          <p className="mt-2">Please try signing in again.</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full" asChild>
            <Link href="/login">Try Again</Link>
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/dashboard">Continue without signing in</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
