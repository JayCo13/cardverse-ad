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

        const { count: openContactRequests } = await supabase
            .from('contact_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open');

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

        // Withdrawal events are persisted at request time. Unlike deriving the
        // feed from the current withdrawal status, this remains visible even
        // when an admin opens the dashboard after the request was processed.
        const { data: recentWithdrawalNotifications } = await supabase
            .from('admin_withdrawal_notifications')
            .select('withdrawal_id, user_id, amount_requested, fee, amount_net, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentWithdrawalNotifications?.length) {
            const withdrawalUserIds = [...new Set(recentWithdrawalNotifications.map((notification) => notification.user_id))];
            const { data: withdrawalProfiles } = await supabase
                .from('profiles')
                .select('id, display_name, email')
                .in('id', withdrawalUserIds);
            const withdrawalProfileMap = new Map((withdrawalProfiles || []).map((profile) => [profile.id, profile]));

            for (const notification of recentWithdrawalNotifications) {
                const profile = withdrawalProfileMap.get(notification.user_id);
                const sellerName = profile?.display_name || profile?.email || 'Seller CardVerseHub';
                notifications.push({
                    id: `withdrawal-request-${notification.withdrawal_id}`,
                    type: 'withdrawal_pending',
                    title: `💸 Yêu cầu rút tiền mới: ${sellerName}`,
                    message: `${notification.amount_requested.toLocaleString('vi-VN')}đ · Phí ${notification.fee.toLocaleString('vi-VN')}đ · Thực chuyển ${notification.amount_net.toLocaleString('vi-VN')}đ`,
                    read: false,
                    created_at: notification.created_at,
                    link: `/withdrawals/${notification.withdrawal_id}`,
                });
            }
        }

        // Contact requests are their own inbox rather than an email-client
        // side effect, so a new ticket always surfaces in the admin bell.
        const { data: recentContactRequests } = await supabase
            .from('contact_requests')
            .select('id, name, email, subject, status, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentContactRequests) {
            for (const contact of recentContactRequests) {
                notifications.push({
                    id: `contact-${contact.id}`,
                    type: 'contact_request',
                    title: `✉️ Liên hệ mới: ${contact.subject}`,
                    message: `${contact.name} · ${contact.email}`,
                    read: contact.status !== 'open',
                    created_at: contact.updated_at || contact.created_at,
                    link: `/contact-requests/${contact.id}`,
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
            + (openContactRequests || 0)
            + (disputedOrders || 0)
            + (newOrders || 0);

        return NextResponse.json({
            notifications: notifications.slice(0, limit),
            unreadCount,
            badges: {
                pendingKYC: pendingKYC || 0,
                pendingWithdrawals: pendingWithdrawals || 0,
                openContactRequests: openContactRequests || 0,
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
