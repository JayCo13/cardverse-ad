import { createClient } from '@supabase/supabase-js'

// This creates a Supabase client capable of bypassing RLS and managing users.
// IMPORTANT: This should ONLY ever be used in secure API routes 
// where the caller's permissions (like `moderator_session`) have already been verified.
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}
