import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';
import { sendOrderRefundEmails } from '@/utils/mail/order-notifications';

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
    // Only an authenticated moderator may move escrow money.
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { order_id, action, note } = body; // action: 'refund_buyer' | 'release_seller'

        if (!order_id || !['refund_buyer', 'release_seller'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                id, buyer_id, seller_id, card_id, amount, total_paid, status, metadata,
                card:cards(name),
                buyer:profiles!orders_buyer_id_fkey(email),
                seller:profiles!orders_seller_id_fkey(email)
            `)
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        // Only escalated/disputed orders can be resolved, and only once.
        if (order.status !== 'disputed') {
            return NextResponse.json({ error: 'already_resolved', status: order.status }, { status: 409 });
        }

        const now = new Date().toISOString();
        const shortId = String(order_id).substring(0, 8);

        if (action === 'refund_buyer') {
            // CAS: only the request that flips disputed → cancelled refunds.
            const { data: claimed } = await supabase
                .from('orders')
                .update({ status: 'cancelled', updated_at: now })
                .eq('id', order_id)
                .eq('status', 'disputed')
                .select('id')
                .maybeSingle();
            if (!claimed) {
                return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
            }

            // Refund the buyer via the atomic wallet RPC (balance + ledger in one tx).
            const { error: refundErr } = await supabase.rpc('credit_wallet', {
                p_user_id: order.buyer_id,
                p_amount: order.total_paid,
                p_type: 'refund',
                p_description: `Hoàn tiền - Đơn #${shortId} (admin xử lý khiếu nại)`,
                p_reference_id: order_id,
            });
            if (refundErr) {
                await supabase.from('orders').update({ status: 'disputed', updated_at: now }).eq('id', order_id).eq('status', 'cancelled');
                throw refundErr;
            }

            // Relist inventory: bundle → add the bought cards back; single card is
            // also relisted by the DB trigger, but we do it here so it works even
            // if the trigger migration hasn't been applied yet.
            const selection = Array.isArray((order.metadata as any)?.bundle_selection) ? (order.metadata as any).bundle_selection : [];
            if (selection.length > 0) {
                const { data: cardRow } = await supabase.from('cards').select('bundle_items').eq('id', order.card_id).single();
                const items = Array.isArray((cardRow as any)?.bundle_items) ? (cardRow as any).bundle_items : [];
                await supabase.from('cards').update({ bundle_items: [...items, ...selection], status: 'active', reserved_until: null, updated_at: now }).eq('id', order.card_id);
            } else {
                await supabase.from('cards').update({ status: 'active', reserved_until: null, updated_at: now }).eq('id', order.card_id).in('status', ['sold', 'in_transaction']);
            }

            await supabase.from('notifications').insert([
                { user_id: order.buyer_id, type: 'order_refunded', title: 'Đã hoàn tiền', message: `Quản trị viên đã hoàn ${Number(order.total_paid).toLocaleString()}đ vào ví CardVerse của bạn.`, card_id: order.card_id, order_id, read: false },
                { user_id: order.seller_id, type: 'order_cancelled', title: 'Đơn hàng đã huỷ', message: 'Quản trị viên đã hoàn tiền cho người mua sau khi kiểm tra khiếu nại.', card_id: order.card_id, order_id, read: false },
            ]);

            // Email both parties (best-effort; must not block the refund).
            await sendOrderRefundEmails({
                buyerEmail: (order as any).buyer?.email,
                sellerEmail: (order as any).seller?.email,
                cardName: (order as any).card?.name || 'Thẻ',
                amount: order.total_paid,
                orderId: order_id,
                note: typeof note === 'string' ? note : undefined,
            });

            return NextResponse.json({ success: true, status: 'cancelled' });
        }

        // release_seller — seller gets the FULL amount (the 5% fee is taken at
        // withdrawal, matching confirm_received / the auto-release model).
        const { data: claimed } = await supabase
            .from('orders')
            .update({ status: 'completed', buyer_confirmed_at: now, updated_at: now })
            .eq('id', order_id)
            .eq('status', 'disputed')
            .select('id')
            .maybeSingle();
        if (!claimed) {
            return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
        }

        const { error: payErr } = await supabase.rpc('credit_wallet', {
            p_user_id: order.seller_id,
            p_amount: order.amount,
            p_type: 'marketplace_sale',
            p_description: `Bán thẻ - Đơn #${shortId} (admin duyệt giao thành công)`,
            p_reference_id: order_id,
        });
        if (payErr) {
            await supabase.from('orders').update({ status: 'disputed', buyer_confirmed_at: null, updated_at: now }).eq('id', order_id).eq('status', 'completed');
            throw payErr;
        }

        await supabase.from('notifications').insert([
            { user_id: order.seller_id, type: 'order_completed', title: 'Đơn hàng hoàn tất', message: `Quản trị viên xác nhận đã giao thành công. ${Number(order.amount).toLocaleString()}đ đã cộng vào ví.`, card_id: order.card_id, order_id, read: false },
            { user_id: order.buyer_id, type: 'order_completed', title: 'Đơn hàng đã hoàn tất', message: 'Quản trị viên đã xử lý đơn của bạn.', card_id: order.card_id, order_id, read: false },
        ]);

        return NextResponse.json({ success: true, status: 'completed' });
    } catch (error: any) {
        console.error('Admin resolve dispute error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
