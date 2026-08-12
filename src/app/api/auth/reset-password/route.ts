import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Password recovery is intentionally public, so it must never use the
    // service-role key or enumerate users. Supabase sends mail only when the
    // account is eligible; callers always receive the same response.
    if (email !== process.env.MODERATOR_EMAIL?.trim().toLowerCase()) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
      });
      if (error) console.error('[/api/auth/reset-password] Supabase error:', error.message);
    }

    return NextResponse.json({ message: 'If the account is eligible, a reset link has been sent.' });
  } catch (error: unknown) {
    console.error(
      '[/api/auth/reset-password] Error:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
