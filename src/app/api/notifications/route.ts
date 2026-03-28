import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// GET: Fetch admin-relevant notifications
export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');

        // Admin notifications: KYC requests, disputes, new orders, system events
        // We fetch notifications of admin-relevant types OR recent seller verifications / disputed orders
        const adminTypes = [
            'kyc_submitted', 'order_disputed', 'system',
        ];

        // 1. Get pending KYC count
        const { count: pendingKYC } = await supabase
            .from('seller_verifications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');

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
            .gte('created_at', oneDayAgo);

        // 4. Build admin notification feed from recent events
        const notifications = [];

        // Get recent KYC submissions
        const { data: recentKYC } = await supabase
            .from('seller_verifications')
            .select('id, user_id, full_name, status, created_at')
            .order('created_at', { ascending: false })
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
                    created_at: kyc.created_at,
                    link: '/kyc',
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
            .select('id, amount, platform_fee, status, created_at')
            .in('status', ['paid', 'completed'])
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentCompleted) {
            for (const order of recentCompleted) {
                const fee = order.platform_fee || 0;
                notifications.push({
                    id: `order-${order.id}`,
                    type: 'order',
                    title: order.status === 'completed'
                        ? `💰 Đơn hoàn tất #${order.id.substring(0, 8)}`
                        : `🛒 Đơn mới #${order.id.substring(0, 8)}`,
                    message: `${(order.amount || 0).toLocaleString()}đ (phí sàn: ${fee.toLocaleString()}đ)`,
                    read: order.status === 'completed',
                    created_at: order.created_at,
                    link: '/marketplace',
                });
            }
        }

        // Sort by created_at desc
        notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const unreadCount = (pendingKYC || 0) + (disputedOrders || 0);

        return NextResponse.json({
            notifications: notifications.slice(0, limit),
            unreadCount,
            badges: {
                pendingKYC: pendingKYC || 0,
                disputedOrders: disputedOrders || 0,
                newOrders24h: newOrders || 0,
            },
        });
    } catch (error: any) {
        console.error('Admin notifications error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
