import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

export async function GET() {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const supabaseAdmin = createAdminClient();

        // Run ALL 4 queries in parallel instead of sequentially
        const [paymentsResult, subsResult, newsResult, scansResult] = await Promise.all([
            // 1. Total Revenue (Sum of 'paid' payment_orders)
            supabaseAdmin
                .from('payment_orders')
                .select('amount')
                .eq('status', 'paid'),
            // 2. Active Subscriptions
            supabaseAdmin
                .from('user_subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active'),
            // 3. Newsletter Subscribers
            supabaseAdmin
                .from('newsletter_subscribers')
                .select('*', { count: 'exact', head: true }),
            // 4. Total Scans (All time)
            supabaseAdmin
                .from('user_scan_history')
                .select('*', { count: 'exact', head: true }),
        ]);

        if (paymentsResult.error) throw paymentsResult.error;
        if (subsResult.error) throw subsResult.error;
        if (newsResult.error) throw newsResult.error;
        if (scansResult.error) throw scansResult.error;

        const totalRevenue = (paymentsResult.data || []).reduce((sum, order) => sum + (order.amount || 0), 0);

        return NextResponse.json({
            totalRevenue,
            activeSubscriptions: subsResult.count || 0,
            newsletterSubscribers: newsResult.count || 0,
            totalScans: scansResult.count || 0,
        }, { status: 200 });

    } catch (error: any) {
        console.error('[/api/dashboard GET] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
