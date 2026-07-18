import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

// GET: Fetch admin-relevant notifications
export async function GET(request: NextRequest) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');

        // Admin notifications: KYC requests, disputes, new orders, system events
        // We fetch notifications of admin-relevant types OR recent seller verifications / disputed orders
        // 1. Get pending KYC count
        const { count: pendingKYC } = await supabase
            .from('seller_verifications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

        const { count: pendingWithdrawals } = await supabase
            .from('wallet_withdrawals')
            .select('id', { count: 'exact', head: true })
            .in('status', ['pending', 'processing']);

        // 2. Get disputed orders count
        const { count: disputedOrders } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'disputed');

        // 3. Get recent orders (new orders in last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: newOrders } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'paid')
            .gte('created_at', oneDayAgo);

        // 4. Build admin notification feed from recent events
        const notifications = [];

        // Get recent KYC submissions
        const { data: recentKYC } = await supabase
            .from('seller_verifications')
            .select('id, user_id, full_name, status, created_at, updated_at')
            .order('updated_at', { ascending: false })
            .limit(10);

        if (recentKYC) {
            for (const kyc of recentKYC) {
                notifications.push({
                    id: `kyc-${kyc.id}`,
                    type: kyc.status === 'pending' ? 'kyc_pending' : kyc.status === 'approved' ? 'kyc_approved' : 'kyc_rejected',
                    title: kyc.status === 'pending'
                        ? `🔔 KYC mới: ${kyc.full_name}`
                        : kyc.status === 'approved'
                            ? `✅ KYC đã duyệt: ${kyc.full_name}`
                            : `❌ KYC từ chối: ${kyc.full_name}`,
                    message: kyc.status === 'pending' ? 'Đang chờ duyệt' : '',
                    read: kyc.status !== 'pending',
                    created_at: kyc.updated_at || kyc.created_at,
                    link: '/kyc',
                });
            }
        }

        // Get recent withdrawal requests and attach a human-readable seller.
        const { data: recentWithdrawals } = await supabase
            .from('wallet_withdrawals')
            .select('id, user_id, amount_requested, fee, amount_net, status, created_at, processed_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentWithdrawals?.length) {
            const withdrawalUserIds = [...new Set(recentWithdrawals.map((withdrawal) => withdrawal.user_id))];
            const { data: withdrawalProfiles } = await supabase
                .from('profiles')
                .select('id, display_name, email')
                .in('id', withdrawalUserIds);
            const withdrawalProfileMap = new Map((withdrawalProfiles || []).map((profile) => [profile.id, profile]));

            for (const withdrawal of recentWithdrawals) {
                const profile = withdrawalProfileMap.get(withdrawal.user_id);
                const sellerName = profile?.display_name || profile?.email || 'Seller CardVerse';
                const isPending = withdrawal.status === 'pending' || withdrawal.status === 'processing';
                notifications.push({
                    id: `withdrawal-${withdrawal.id}`,
                    type: isPending ? 'withdrawal_pending' : withdrawal.status === 'completed' ? 'withdrawal_completed' : 'withdrawal_rejected',
                    title: isPending
                        ? `💸 Yêu cầu rút tiền: ${sellerName}`
                        : withdrawal.status === 'completed'
                            ? `✅ Đã chuyển tiền: ${sellerName}`
                            : `❌ Đã từ chối rút tiền: ${sellerName}`,
                    message: `${withdrawal.amount_requested.toLocaleString('vi-VN')}đ · Phí ${withdrawal.fee.toLocaleString('vi-VN')}đ · Thực chuyển ${withdrawal.amount_net.toLocaleString('vi-VN')}đ`,
                    read: !isPending,
                    created_at: withdrawal.processed_at || withdrawal.created_at,
                    link: '/withdrawals',
                });
            }
        }

        // Get recent disputed orders
        const { data: recentDisputes } = await supabase
            .from('orders')
            .select('id, status, dispute_reason, amount, created_at')
            .eq('status', 'disputed')
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentDisputes) {
            for (const order of recentDisputes) {
                notifications.push({
                    id: `dispute-${order.id}`,
                    type: 'dispute',
                    title: `⚠️ Khiếu nại đơn #${order.id.substring(0, 8)}`,
                    message: order.dispute_reason || 'Cần xử lý',
                    read: false,
                    created_at: order.created_at,
                    link: '/marketplace',
                });
            }
        }

        // Get recent completed orders (last 24h)
        const { data: recentCompleted } = await supabase
            .from('orders')
            .select('id, buyer_id, seller_id, card_id, amount, platform_fee, status, created_at')
            .in('status', ['paid', 'completed'])
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentCompleted?.length) {
            const profileIds = [...new Set(recentCompleted.flatMap((order) => [order.buyer_id, order.seller_id]))];
            const cardIds = [...new Set(recentCompleted.map((order) => order.card_id))];
            const [{ data: orderProfiles }, { data: orderCards }] = await Promise.all([
                supabase.from('profiles').select('id, display_name, email').in('id', profileIds),
                supabase.from('cards').select('id, name').in('id', cardIds),
            ]);
            const orderProfileMap = new Map((orderProfiles || []).map((profile) => [profile.id, profile]));
            const orderCardMap = new Map((orderCards || []).map((card) => [card.id, card.name]));

            for (const order of recentCompleted) {
                const fee = order.platform_fee || 0;
                const buyer = orderProfileMap.get(order.buyer_id);
                const seller = orderProfileMap.get(order.seller_id);
                const buyerName = buyer?.display_name || buyer?.email || 'Người mua';
                const sellerName = seller?.display_name || seller?.email || 'Người bán';
                const cardName = orderCardMap.get(order.card_id) || `#${order.id.substring(0, 8)}`;
                notifications.push({
                    id: `order-${order.id}`,
                    type: 'order',
                    title: order.status === 'completed'
                        ? `💰 Đơn hoàn tất: ${cardName}`
                        : `🛒 Đơn mới: ${cardName}`,
                    message: `${buyerName} mua từ ${sellerName} · ${(order.amount || 0).toLocaleString('vi-VN')}đ · Phí sàn ${fee.toLocaleString('vi-VN')}đ`,
                    read: order.status === 'completed',
                    created_at: order.created_at,
                    link: '/marketplace',
                });
            }
        }

        // Sort by created_at desc
        notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const unreadCount = (pendingKYC || 0)
            + (pendingWithdrawals || 0)
            + (disputedOrders || 0)
            + (newOrders || 0);

        return NextResponse.json({
            notifications: notifications.slice(0, limit),
            unreadCount,
            badges: {
                pendingKYC: pendingKYC || 0,
                pendingWithdrawals: pendingWithdrawals || 0,
                disputedOrders: disputedOrders || 0,
                newOrders24h: newOrders || 0,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Admin notifications error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
