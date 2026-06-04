import { createClient } from '@/utils/supabase/server'
import { resolveAdminOrigin } from '@/utils/adminUrl'
import { NextResponse } from 'next/server'

// OAuth callback for the admin panel (e.g. "Sign in with Google").
// The Supabase project is shared with the consumer app, so a successful
// Google sign-in is NOT enough — the account must have been granted
// app_metadata.role === 'admin' by a moderator. Any account without that
// role is signed back out and bounced to the admin login with an error.
export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    // Always resolve to the canonical admin origin so we never redirect onto
    // the shared consumer site, and so the session cookie set here matches the
    // domain the user ends up on.
    const origin = resolveAdminOrigin(requestUrl.origin)

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=oauth`)
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
        console.error('Admin OAuth callback: code exchange failed:', error.message)
        return NextResponse.redirect(`${origin}/login?error=oauth`)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user?.app_metadata?.role !== 'admin') {
        // Block every non-admin account.
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=not_admin`)
    }

    // Verified admin → land on the admin dashboard.
    return NextResponse.redirect(`${origin}/`)
}
