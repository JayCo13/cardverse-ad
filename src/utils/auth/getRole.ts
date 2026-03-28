import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export type AdminRole = 'moderator' | 'admin' | null;

/**
 * Determines the current user's role.
 * - 'moderator': Highest authority, env-based login via cookie.
 * - 'admin': Supabase Auth user.
 * - null: Not authenticated.
 */
export async function getRole(): Promise<AdminRole> {
    const cookieStore = await cookies();
    if (cookieStore.get('moderator_session')?.value === 'true') return 'moderator';

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll() { },
                },
            }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) return 'admin';
    } catch { }
    return null;
}
