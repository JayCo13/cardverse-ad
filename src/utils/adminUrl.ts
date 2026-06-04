// Canonical admin-panel URL.
//
// The Supabase project is SHARED with the consumer app, whose Site URL is
// https://cardversehub.com. If an OAuth redirect target isn't in Supabase's
// allow-list, Supabase falls back to that Site URL — which is why Google
// sign-in was landing back on the user site. We therefore redirect OAuth
// explicitly to this admin URL on both legs of the flow.
export const ADMIN_URL = (
    process.env.NEXT_PUBLIC_ADMIN_URL || 'https://cardverse-mangement-team-global.netlify.app'
).replace(/\/+$/, '');

/**
 * Base origin to use for admin redirects. Keeps localhost during local
 * development, but forces the canonical admin URL everywhere else so the
 * OAuth flow never leaks to the shared consumer site.
 */
export function resolveAdminOrigin(currentOrigin: string): string {
    try {
        const host = new URL(currentOrigin).hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return currentOrigin.replace(/\/+$/, '');
        }
    } catch {
        // fall through to the canonical URL
    }
    return ADMIN_URL;
}
