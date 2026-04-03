import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = await getRole();

    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated to view user details.' }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const { id } = await params;
        const supabaseAdmin = createAdminClient();

        // Run ALL 5 queries in parallel instead of sequentially
        const [authResult, profileResult, subsResult, scanUsageResult, scanHistoryResult] = await Promise.all([
            // 1. Fetch User Auth Data
            supabaseAdmin.auth.admin.getUserById(id),
            // 2. Fetch User Profile
            supabaseAdmin.from('profiles').select('*').eq('id', id).single(),
            // 3. Fetch Subscription Packages
            supabaseAdmin.from('user_subscriptions').select('*').eq('user_id', id),
            // 4. Fetch Scan Usage
            supabaseAdmin.from('user_scan_usage').select('*').eq('user_id', id).single(),
            // 5. Fetch Scan History
            supabaseAdmin.from('user_scan_history').select('created_at').eq('user_id', id),
        ]);

        const { data: { user }, error: authError } = authResult;
        if (authError || !user) throw new Error(authError?.message || 'User not found');

        // Compute Aggregations based on scanHistory
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

        let scansToday = 0;
        let scansThisMonth = 0;
        let scansThisYear = 0;

        const historyRecords = scanHistoryResult.data || [];
        historyRecords.forEach(record => {
            const time = new Date(record.created_at).getTime();
            if (time >= startOfDay) scansToday++;
            if (time >= startOfMonth) scansThisMonth++;
            if (time >= startOfYear) scansThisYear++;
        });

        // Use the legacy exact count if history is out of sync for today, but default to history
        const scanUsage = scanUsageResult.data;
        const effectiveToday = Math.max(scansToday, scanUsage?.scan_count || 0);

        return NextResponse.json({
            authInfo: user,
            profile: profileResult.data || null,
            subscriptions: subsResult.data || [],
            scanStats: {
                total: historyRecords.length,
                today: effectiveToday,
                thisMonth: scansThisMonth,
                thisYear: scansThisYear,
                lastResetDate: scanUsage?.last_reset_date || null
            },
        }, { status: 200 });

    } catch (error: any) {
        console.error('[/api/users/[id]/details] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
