import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { mergeSessionToUser } from '@/lib/session';

const SESSION_COOKIE_NAME = 'debtdetox_session_id';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if there's an anonymous session to merge
      const cookieStore = await cookies();
      const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

      if (sessionId) {
        try {
          await mergeSessionToUser(sessionId, data.user.id);
          // Clear the session cookie
          cookieStore.delete(SESSION_COOKIE_NAME);
        } catch (mergeError) {
          console.error('Failed to merge session:', mergeError);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
