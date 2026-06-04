import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// OAuth callback for the admin panel (e.g. "Sign in with Google").
// The Supabase project is shared with the consumer app, so a successful
// Google sign-in is NOT enough — the account must have been granted
// app_metadata.role === 'admin' by a moderator. Otherwise we sign the
// session back out and bounce to /login with an error.
export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

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
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=not_admin`)
    }

    return NextResponse.redirect(`${origin}/`)
}
