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

        // 1. Total Revenue (Sum of 'paid' payment_orders)
        const { data: payments, error: paymentsError } = await supabaseAdmin
            .from('payment_orders')
            .select('amount')
            .eq('status', 'paid');

        if (paymentsError) throw paymentsError;
        const totalRevenue = payments.reduce((sum, order) => sum + (order.amount || 0), 0);

        // 2. Active Subscriptions
        const { count: activeSubs, error: subsError } = await supabaseAdmin
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        if (subsError) throw subsError;

        // 3. Newsletter Subscribers
        const { count: newsletterSubs, error: newsError } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('*', { count: 'exact', head: true });

        if (newsError) throw newsError;

        // 4. Total Scans (All time)
        const { count: totalScans, error: scansError } = await supabaseAdmin
            .from('user_scan_history')
            .select('*', { count: 'exact', head: true });

        if (scansError) throw scansError;

        return NextResponse.json({
            totalRevenue,
            activeSubscriptions: activeSubs || 0,
            newsletterSubscribers: newsletterSubs || 0,
            totalScans: totalScans || 0,
        }, { status: 200 });

    } catch (error: any) {
        console.error('[/api/dashboard GET] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
