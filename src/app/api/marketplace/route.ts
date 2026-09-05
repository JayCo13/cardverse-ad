import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getAdminActor, getRole } from '@/utils/auth/getRole';
import { sendOrderRefundEmails } from '@/utils/mail/order-notifications';

// GET: List all marketplace orders
export async function GET(request: NextRequest) {
    if (!await getRole()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

        // The evidence rule lives in the database function, not here: what the
        // reviewer is shown and what the policy says must not be able to drift.
        // Only disputed rows need it, and there are rarely many in one page.
        const orders = ordersResult.data || [];
        const disputed = orders.filter(o => o.status === 'disputed');
        const verdicts = await Promise.all(disputed.map(async (order) => {
            const { data } = await supabase.rpc('dispute_evidence_verdict', { p_order_id: order.id });
            return [order.id, data] as const;
        }));
        const verdictById = new Map(verdicts);
        for (const order of orders) {
            (order as Record<string, unknown>).evidence = verdictById.get(order.id) ?? null;
        }

        const allOrders = statsResult.data;
        const stats = {
            total: allOrders?.length || 0,
            completed: allOrders?.filter(o => o.status === 'completed').length || 0,
            disputed: allOrders?.filter(o => o.status === 'disputed').length || 0,
            totalRevenue: allOrders?.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.platform_fee || 0), 0) || 0,
            totalVolume: allOrders?.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.amount || 0), 0) || 0,
        };

        return NextResponse.json({ orders, stats });
    } catch (error: any) {
        console.error('Admin marketplace error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Admin resolve dispute
export async function PATCH(request: NextRequest) {
    const actor = await getAdminActor();
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const supabase = createAdminClient();
        const idempotencyKey = request.headers.get('idempotency-key');
        if (!idempotencyKey || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
            return NextResponse.json({ error: 'Idempotency-Key is required' }, { status: 400 });
        }
        const body = await request.json();
        const { order_id, action, note } = body; // action: 'refund_buyer' | 'release_seller'

        if (!order_id || !['refund_buyer', 'release_seller'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        let refundMailContext: {
            buyerEmail?: string | null;
            sellerEmail?: string | null;
            cardName: string;
            amount: number;
        } | null = null;

        if (action === 'refund_buyer') {
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select(`
                    total_paid,
                    card:cards(name),
                    buyer:profiles!orders_buyer_id_fkey(email),
                    seller:profiles!orders_seller_id_fkey(email)
                `)
                .eq('id', order_id)
                .maybeSingle();

            if (orderError || !order) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 });
            }

            const mailOrder = order as typeof order & {
                card?: { name?: string | null } | null;
                buyer?: { email?: string | null } | null;
                seller?: { email?: string | null } | null;
            };
            refundMailContext = {
                buyerEmail: mailOrder.buyer?.email,
                sellerEmail: mailOrder.seller?.email,
                cardName: mailOrder.card?.name || 'Thẻ',
                amount: Number(mailOrder.total_paid),
            };
        }

        // Snapshot what the evidence looked like at the moment of the decision.
        // Written before the resolution so a reviewer can always see what the
        // call was made against, including when it went against the rule.
        const { data: verdictAtDecision } = await supabase.rpc('dispute_evidence_verdict', { p_order_id: order_id });
        if (verdictAtDecision) {
            const { data: current } = await supabase
                .from('orders').select('metadata').eq('id', order_id).maybeSingle();
            const existing = (current?.metadata && typeof current.metadata === 'object') ? current.metadata : {};
            await supabase.from('orders').update({
                metadata: {
                    ...existing,
                    dispute_decision: {
                        action,
                        actor_id: actor.id,
                        actor_role: actor.role,
                        decided_at: new Date().toISOString(),
                        evidence: verdictAtDecision,
                    },
                },
            }).eq('id', order_id);
        }

        const { data: resolution, error: resolutionError } = await supabase.rpc('resolve_marketplace_dispute', {
            p_order_id: order_id,
            p_action: action,
            p_actor_id: actor.id,
            p_actor_role: actor.role,
            p_idempotency_key: idempotencyKey,
        });
        if (resolutionError) throw resolutionError;

        const result = resolution as { replayed?: boolean } | null;
        if (action === 'refund_buyer' && refundMailContext && !result?.replayed) {
            await sendOrderRefundEmails({
                buyerEmail: refundMailContext.buyerEmail,
                sellerEmail: refundMailContext.sellerEmail,
                cardName: refundMailContext.cardName,
                amount: refundMailContext.amount,
                orderId: order_id,
                note: typeof note === 'string' ? note : undefined,
            });
        }

        return NextResponse.json({ success: true, ...resolution });
    } catch (error: any) {
        console.error('Admin resolve dispute error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
