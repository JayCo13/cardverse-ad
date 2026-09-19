import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActivityItem = {
    id: string;
    type: 'account' | 'subscription' | 'listing' | 'offer' | 'order' | 'wallet' | 'withdrawal' | 'kyc';
    title: string;
    description: string | null;
    status: string | null;
    amount: number | null;
    createdAt: string;
};

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
        if (!UUID_PATTERN.test(id)) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
        }
        const supabaseAdmin = createAdminClient();

        const activityLimit = 25;
        const [
            authResult,
            profileResult,
            subsResult,
            scanUsageResult,
            scanHistoryResult,
            listingsResult,
            offersResult,
            ordersResult,
            walletResult,
            withdrawalsResult,
            kycResult,
        ] = await Promise.all([
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
            // Marketplace and account activity. Return recent rows and exact
            // totals so the detail page shows both volume and chronology.
            supabaseAdmin.from('cards')
                .select('id,name,status,created_at', { count: 'exact' })
                .eq('seller_id', id).order('created_at', { ascending: false }).limit(activityLimit),
            supabaseAdmin.from('offers')
                .select('id,card_id,price,status,created_at', { count: 'exact' })
                .eq('buyer_id', id).order('created_at', { ascending: false }).limit(activityLimit),
            supabaseAdmin.from('orders')
                .select('id,card_id,buyer_id,seller_id,amount,total_paid,status,created_at', { count: 'exact' })
                .or(`buyer_id.eq.${id},seller_id.eq.${id}`)
                .order('created_at', { ascending: false }).limit(activityLimit),
            supabaseAdmin.from('wallet_transactions')
                .select('id,type,amount,description,created_at', { count: 'exact' })
                .eq('user_id', id).order('created_at', { ascending: false }).limit(activityLimit),
            supabaseAdmin.from('wallet_withdrawals')
                .select('id,amount_requested,status,created_at', { count: 'exact' })
                .eq('user_id', id).order('created_at', { ascending: false }).limit(activityLimit),
            supabaseAdmin.from('seller_verifications')
                .select('id,status,created_at,updated_at', { count: 'exact' })
                .eq('user_id', id).order('created_at', { ascending: false }).limit(activityLimit),
        ]);

        const { data: { user }, error: authError } = authResult;
        if (authError || !user) throw new Error(authError?.message || 'User not found');

        const activityResults = [listingsResult, offersResult, ordersResult, walletResult, withdrawalsResult, kycResult];
        const activityError = activityResults.find(result => result.error)?.error;
        if (activityError) throw activityError;

        const cardIds = [...new Set([
            ...(offersResult.data || []).map(row => row.card_id),
            ...(ordersResult.data || []).map(row => row.card_id),
        ].filter(Boolean))];
        const cardNames = new Map<string, string>();
        if (cardIds.length > 0) {
            const { data: cards, error: cardsError } = await supabaseAdmin
                .from('cards').select('id,name').in('id', cardIds);
            if (cardsError) throw cardsError;
            for (const card of cards || []) cardNames.set(card.id, card.name);
        }

        const activities: ActivityItem[] = [];
        activities.push({
            id: `account-created:${user.id}`,
            type: 'account',
            title: 'Account created',
            description: user.email || null,
            status: null,
            amount: null,
            createdAt: user.created_at,
        });
        if (user.last_sign_in_at) activities.push({
            id: `last-sign-in:${user.id}`,
            type: 'account',
            title: 'Last signed in',
            description: null,
            status: null,
            amount: null,
            createdAt: user.last_sign_in_at,
        });
        for (const subscription of subsResult.data || []) activities.push({
            id: `subscription:${subscription.id}`,
            type: 'subscription',
            title: 'Subscription started',
            description: String(subscription.package_type || '').replaceAll('_', ' '),
            status: subscription.status || null,
            amount: null,
            createdAt: subscription.starts_at,
        });
        for (const listing of listingsResult.data || []) activities.push({
            id: `listing:${listing.id}`,
            type: 'listing',
            title: 'Created listing',
            description: listing.name,
            status: listing.status,
            amount: null,
            createdAt: listing.created_at,
        });
        for (const offer of offersResult.data || []) activities.push({
            id: `offer:${offer.id}`,
            type: 'offer',
            title: 'Submitted offer',
            description: cardNames.get(offer.card_id) || 'Marketplace listing',
            status: offer.status,
            amount: Number(offer.price),
            createdAt: offer.created_at,
        });
        for (const order of ordersResult.data || []) {
            const isBuyer = order.buyer_id === id;
            activities.push({
                id: `order:${order.id}`,
                type: 'order',
                title: isBuyer ? 'Placed order' : 'Received sale',
                description: cardNames.get(order.card_id) || 'Marketplace listing',
                status: order.status,
                amount: Number(isBuyer ? order.total_paid : order.amount),
                createdAt: order.created_at,
            });
        }
        for (const transaction of walletResult.data || []) activities.push({
            id: `wallet:${transaction.id}`,
            type: 'wallet',
            title: `Wallet: ${String(transaction.type).replaceAll('_', ' ')}`,
            description: transaction.description || null,
            status: null,
            amount: Number(transaction.amount),
            createdAt: transaction.created_at,
        });
        for (const withdrawal of withdrawalsResult.data || []) activities.push({
            id: `withdrawal:${withdrawal.id}`,
            type: 'withdrawal',
            title: 'Requested withdrawal',
            description: null,
            status: withdrawal.status,
            amount: Number(withdrawal.amount_requested),
            createdAt: withdrawal.created_at,
        });
        for (const verification of kycResult.data || []) {
            const createdAt = verification.updated_at || verification.created_at;
            if (!createdAt) continue;
            activities.push({
                id: `kyc:${verification.id}`,
                type: 'kyc',
                title: 'Seller verification',
                description: null,
                status: verification.status,
                amount: null,
                createdAt,
            });
        }
        activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
            activityStats: {
                listings: listingsResult.count || 0,
                offers: offersResult.count || 0,
                orders: ordersResult.count || 0,
                walletTransactions: walletResult.count || 0,
                withdrawals: withdrawalsResult.count || 0,
            },
            recentActivity: activities.slice(0, 50),
        }, {
            status: 200,
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to load user details';
        console.error('[/api/users/[id]/details] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
