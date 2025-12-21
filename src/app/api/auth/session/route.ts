import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getOrCreateSession();
    return NextResponse.json(session);
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
