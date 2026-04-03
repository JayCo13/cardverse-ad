import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// GET: List all marketplace orders
export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let query = supabase
            .from('orders')
            .select(`
                *,
                card:cards(id, name, image_url, category),
                buyer:profiles!orders_buyer_id_fkey(id, display_name, email),
                seller:profiles!orders_seller_id_fkey(id, display_name, email, seller_verified)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (status) {
            query = query.eq('status', status);
        }

        // Run orders + stats queries in parallel
        const [ordersResult, statsResult] = await Promise.all([
            query,
            supabase.from('orders').select('status, amount, platform_fee'),
        ]);

        if (ordersResult.error) throw ordersResult.error;

        const allOrders = statsResult.data;
        const stats = {
            total: allOrders?.length || 0,
            completed: allOrders?.filter(o => o.status === 'completed').length || 0,
            disputed: allOrders?.filter(o => o.status === 'disputed').length || 0,
            totalRevenue: allOrders?.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.platform_fee || 0), 0) || 0,
            totalVolume: allOrders?.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.amount || 0), 0) || 0,
        };

        return NextResponse.json({ orders: ordersResult.data || [], stats });
    } catch (error: any) {
        console.error('Admin marketplace error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Admin resolve dispute
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { order_id, action } = body; // action: 'refund_buyer' | 'release_seller'

        if (!order_id || !['refund_buyer', 'release_seller'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (action === 'refund_buyer') {
            // Refund buyer wallet
            const { data: buyerWallet } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', order.buyer_id)
                .single();

            if (buyerWallet) {
                const newBalance = buyerWallet.available_balance + order.total_paid;
                await supabase.from('wallets').update({
                    available_balance: newBalance,
                    updated_at: new Date().toISOString(),
                }).eq('user_id', order.buyer_id);

                await supabase.from('wallet_transactions').insert({
                    wallet_id: buyerWallet.id,
                    user_id: order.buyer_id,
                    type: 'escrow_release',
                    amount: order.total_paid,
                    balance_after: newBalance,
                    description: `Hoàn tiền dispute - Đơn #${order_id.substring(0, 8)}`,
                    reference_id: order_id,
                });
            }

            await supabase.from('orders').update({
                status: 'refunded',
                updated_at: new Date().toISOString(),
            }).eq('id', order_id);

            // Restore card
            await supabase.from('cards').update({ status: 'active' }).eq('id', order.card_id);

            // Notify both
            await supabase.from('notifications').insert([
                { user_id: order.buyer_id, type: 'dispute_resolved', title: 'Khiếu nại đã được giải quyết', message: 'Tiền đã được hoàn vào ví của bạn.' },
                { user_id: order.seller_id, type: 'dispute_resolved', title: 'Khiếu nại đã được giải quyết', message: 'Admin đã quyết định hoàn tiền cho người mua. Thẻ sẽ được khôi phục.' },
            ]);

        } else {
            // Release to seller
            const sellerPayout = order.amount - order.platform_fee;
            const { data: sellerWallet } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', order.seller_id)
                .single();

            if (sellerWallet) {
                const newBalance = sellerWallet.available_balance + sellerPayout;
                await supabase.from('wallets').update({
                    available_balance: newBalance,
                    updated_at: new Date().toISOString(),
                }).eq('user_id', order.seller_id);

                await supabase.from('wallet_transactions').insert({
                    wallet_id: sellerWallet.id,
                    user_id: order.seller_id,
                    type: 'marketplace_sale',
                    amount: sellerPayout,
                    balance_after: newBalance,
                    description: `Bán thẻ (dispute resolved) - Đơn #${order_id.substring(0, 8)}`,
                    reference_id: order_id,
                });
            }

            await supabase.from('orders').update({
                status: 'completed',
                updated_at: new Date().toISOString(),
            }).eq('id', order_id);

            await supabase.from('notifications').insert([
                { user_id: order.seller_id, type: 'dispute_resolved', title: 'Khiếu nại đã được giải quyết', message: `Tiền đã được chuyển vào ví. +${sellerPayout.toLocaleString()}đ` },
                { user_id: order.buyer_id, type: 'dispute_resolved', title: 'Khiếu nại đã được giải quyết', message: 'Admin đã quyết định giữ giao dịch hợp lệ.' },
            ]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Admin resolve dispute error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
