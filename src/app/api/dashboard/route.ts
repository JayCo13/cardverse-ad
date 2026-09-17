import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

const ORDER_STATUS_GROUPS = [
    { key: 'pending', label: 'Chờ thanh toán', statuses: ['pending_payment'] },
    { key: 'paid', label: 'Đã thanh toán', statuses: ['paid'] },
    { key: 'shipping', label: 'Đang giao', statuses: ['shipping', 'delivered'] },
    { key: 'completed', label: 'Hoàn tất', statuses: ['completed'] },
    { key: 'disputed', label: 'Khiếu nại', statuses: ['disputed'] },
    { key: 'closed', label: 'Hủy / hoàn tiền', statuses: ['cancelled', 'refunded'] },
] as const;

export async function GET() {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const supabase = createAdminClient();
        const countOrders = (statuses?: readonly string[]) => {
            let query = supabase.from('orders').select('id', { count: 'exact', head: true });
            if (statuses?.length) query = query.in('status', [...statuses]);
            return query;
        };

        // Supabase limits a result page, so sum every completed order page.
        // This keeps GMV exact after the marketplace grows beyond 1,000 rows.
        const completedVolumePromise = (async () => {
            const pageSize = 1000;
            let from = 0;
            let total = 0;

            while (true) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('amount')
                    .eq('status', 'completed')
                    .range(from, from + pageSize - 1);
                if (error) throw error;

                const rows = data || [];
                total += rows.reduce((sum, order) => sum + Number(order.amount || 0), 0);
                if (rows.length < pageSize) return total;
                from += pageSize;
            }
        })();

        const [
            totalOrdersResult,
            activeOrdersResult,
            pendingKYCResult,
            pendingWithdrawalsResult,
            openContactsResult,
            recentOrdersResult,
            statusResults,
            completedVolume,
        ] = await Promise.all([
            countOrders(),
            countOrders(['paid', 'shipping', 'delivered']),
            supabase.from('seller_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('wallet_withdrawals').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
            supabase.from('contact_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
            supabase
                .from('orders')
                .select('id, status, amount, created_at, card:cards(name), buyer:profiles!orders_buyer_id_fkey(display_name), seller:profiles!orders_seller_id_fkey(display_name)')
                .order('created_at', { ascending: false })
                .limit(8),
            Promise.all(ORDER_STATUS_GROUPS.map((group) => countOrders(group.statuses))),
            completedVolumePromise,
        ]);

        const queryResults = [
            totalOrdersResult,
            activeOrdersResult,
            pendingKYCResult,
            pendingWithdrawalsResult,
            openContactsResult,
            recentOrdersResult,
            ...statusResults,
        ];
        const failed = queryResults.find((result) => result.error);
        if (failed?.error) throw failed.error;

        const statusDistribution = ORDER_STATUS_GROUPS.map((group, index) => ({
            key: group.key,
            label: group.label,
            count: statusResults[index].count || 0,
        }));
        const completedOrders = statusDistribution.find((item) => item.key === 'completed')?.count || 0;
        const disputedOrders = statusDistribution.find((item) => item.key === 'disputed')?.count || 0;
        const pendingKYC = pendingKYCResult.count || 0;
        const pendingWithdrawals = pendingWithdrawalsResult.count || 0;
        const openContacts = openContactsResult.count || 0;

        return NextResponse.json({
            metrics: {
                totalOrders: totalOrdersResult.count || 0,
                completedOrders,
                activeOrders: activeOrdersResult.count || 0,
                completedVolume,
                needsAttention: disputedOrders + pendingKYC + pendingWithdrawals + openContacts,
            },
            attention: {
                disputedOrders,
                pendingKYC,
                pendingWithdrawals,
                openContacts,
            },
            statusDistribution,
            recentOrders: recentOrdersResult.data || [],
            generatedAt: new Date().toISOString(),
        }, {
            status: 200,
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu tổng quan';
        console.error('[/api/dashboard GET] Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
