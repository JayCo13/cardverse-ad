import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { issueModeratorSession, MODERATOR_COOKIE_NAME } from '@/utils/auth/moderatorSession';
import { createAdminClient } from '@/utils/supabase/admin';

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function secureEqual(left: string, right: string) {
  return timingSafeEqual(
    createHash('sha256').update(left).digest(),
    createHash('sha256').update(right).digest(),
  );
}

export async function POST(request: Request) {
  const genericError = () => NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const configuredEmail = process.env.MODERATOR_EMAIL?.trim().toLowerCase() || '';
    const configuredPassword = process.env.MODERATOR_PASSWORD || '';
    if (!configuredEmail || !configuredPassword || !email || !password) return genericError();

    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ipHash = hash(forwardedFor || request.headers.get('x-real-ip') || 'unknown');
    const accountHash = hash(email);
    const admin = createAdminClient();
    const valid = secureEqual(email, configuredEmail) && secureEqual(password, configuredPassword);
    const { data, error: auditError } = await admin.rpc('check_and_record_admin_login_attempt', {
      p_ip_hash: ipHash,
      p_account_hash: accountHash,
      p_credentials_valid: valid,
    });
    const decision = data as { allowed?: boolean; credentials_valid?: boolean } | null;
    if (auditError || !decision) {
      return NextResponse.json({ error: 'Login temporarily unavailable' }, { status: 503 });
    }
    if (!decision.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }
    if (!decision.credentials_valid) return genericError();

    const session = issueModeratorSession();
    const response = NextResponse.json({ success: true, role: 'moderator' });
    response.cookies.set({
      name: MODERATOR_COOKIE_NAME,
      value: session.value,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: session.maxAge,
    });
    return response;
  } catch {
    return genericError();
  }
}
