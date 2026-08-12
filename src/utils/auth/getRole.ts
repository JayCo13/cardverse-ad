import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { MODERATOR_COOKIE_NAME, verifyModeratorSession } from './moderatorSession';

export type AdminRole = 'moderator' | 'admin' | null;
export type AdminActor = { role: Exclude<AdminRole, null>; id: string } | null;

/**
 * Determines the current user's role.
 * - 'moderator': Highest authority, env-based login via cookie.
 * - 'admin': Supabase Auth user explicitly granted app_metadata.role === 'admin'.
 * - null: Not authenticated, or a regular Supabase user without the admin grant.
 *
 * NOTE: this Supabase project is shared with the consumer app, so we must NOT
 * treat every authenticated user as an admin — only those a moderator promoted.
 */
export async function getRole(): Promise<AdminRole> {
    return (await getAdminActor())?.role || null;
}

export async function getAdminActor(): Promise<AdminActor> {
    const cookieStore = await cookies();
    const moderatorSession = verifyModeratorSession(cookieStore.get(MODERATOR_COOKIE_NAME)?.value);
    if (moderatorSession) return { role: 'moderator', id: `moderator:${moderatorSession.sid}` };

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
        if (user && user.app_metadata?.role === 'admin') return { role: 'admin', id: user.id };
    } catch { }
    return null;
}
