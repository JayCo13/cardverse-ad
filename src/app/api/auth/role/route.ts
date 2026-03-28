import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
    const cookieStore = await cookies();

    // Check for Moderator session first (highest authority)
    const hasModeratorSession = cookieStore.get('moderator_session')?.value === 'true';

    if (hasModeratorSession) {
        return NextResponse.json({ role: 'moderator' }, { status: 200 });
    }

    // Check for Supabase Auth session (Admin)
    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll() {
                        // Read-only in this context
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            return NextResponse.json({ role: 'admin' }, { status: 200 });
        }
    } catch {
        // Fall through
    }

    return NextResponse.json({ role: null }, { status: 401 });
}
