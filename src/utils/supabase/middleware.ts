import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Check for Moderator cookie first
    const hasModeratorSession = request.cookies.get('moderator_session')?.value === 'true'

    let user = null;

    // Only hit Supabase if they aren't already authenticated as a moderator
    if (!hasModeratorSession) {
        const { data } = await supabase.auth.getUser()
        user = data.user
    }

    // Protect all routes except /login, /forgot-password, /reset-password, and auth API routes
    const isLoginPage = request.nextUrl.pathname.startsWith('/login')
    const isForgotPasswordPage = request.nextUrl.pathname.startsWith('/forgot-password')
    const isResetPasswordPage = request.nextUrl.pathname.startsWith('/reset-password')
    const isApiAuthRoute = request.nextUrl.pathname.startsWith('/api/auth')

    const isPublicRoute = isLoginPage || isForgotPasswordPage || isResetPasswordPage || isApiAuthRoute
    const isAuthenticated = hasModeratorSession || !!user

    if (!isAuthenticated && !isPublicRoute) {
        // If no user, redirect to login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (isAuthenticated && isLoginPage) {
        // If user is already logged in and tries to access login, redirect to dashboard
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
