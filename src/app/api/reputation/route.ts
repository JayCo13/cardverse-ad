import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getAdminActor, getRole } from '@/utils/auth/getRole';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

/**
 * Standing, and the ledger behind it.
 *
 * The list exists mainly so a wrong penalty can be found and undone. Before this
 * there was no record of who had been docked and why — when 20260904000100
 * discovered the offer sweep had been penalising buyers who had actually paid,
 * the repair had to be re-derived from the orders table by hand.
 */
export async function GET(request: NextRequest) {
    const role = await getRole();
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const admin = createAdminClient();
        const userId = request.nextUrl.searchParams.get('userId');

        if (userId) {
            const [{ data: profile }, { data: events, error }] = await Promise.all([
                admin.from('profiles')
                    .select('id, display_name, email, reputation_score, reputation_incidents_90d, reputation_incidents_total, completed_transactions')
                    .eq('id', userId).maybeSingle(),
                admin.from('reputation_events')
                    .select('id, role, event_type, delta, order_id, offer_id, card_id, note, created_by, created_by_role, voided_at, voided_by, created_at')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(200),
            ]);
            if (error) throw error;
            return NextResponse.json({ profile, events: events || [] }, { headers: NO_STORE });
        }

        // Default view is people with something on their record. A list sorted by
        // score alone puts every brand-new account at the top on zero, which is
        // exactly the reading this system is built to avoid.
        const filter = request.nextUrl.searchParams.get('filter') || 'flagged';
        let query = admin.from('profiles')
            .select('id, display_name, email, reputation_score, reputation_incidents_90d, reputation_incidents_total, completed_transactions')
            .limit(100);

        if (filter === 'flagged') {
            query = query.gte('reputation_incidents_90d', 2).order('reputation_incidents_90d', { ascending: false });
        } else if (filter === 'negative') {
            query = query.lt('reputation_score', 0).order('reputation_score', { ascending: true });
        } else {
            query = query.order('reputation_score', { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ profiles: data || [] }, { headers: NO_STORE });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load reputation';
        console.error('Admin reputation list error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * `void` undoes a penalty; `adjust` adds a manual correction. Both name the
 * operator — the SQL side refuses either without an admin or moderator.
 */
export async function POST(request: NextRequest) {
    const actor = await getAdminActor();
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const admin = createAdminClient();
        const body = await request.json();
        const { action } = body as { action?: string };

        if (action === 'void') {
            const { event_id, reason } = body as { event_id?: string; reason?: string };
            if (!event_id || typeof reason !== 'string' || reason.trim().length < 10) {
                return NextResponse.json({ error: 'Lý do cần ít nhất 10 ký tự.' }, { status: 400 });
            }
            const { data, error } = await admin.rpc('void_reputation_event', {
                p_event_id: event_id,
                p_reason: reason.trim().slice(0, 500),
                p_actor_id: actor.id,
                p_actor_role: actor.role,
            });
            if (error) throw error;
            // false means the row was already voided — a double click, not a failure.
            return NextResponse.json({ success: true, voided: data === true });
        }

        if (action === 'adjust') {
            const { user_id, role, delta, note } = body as
                { user_id?: string; role?: string; delta?: number; note?: string };
            if (!user_id || (role !== 'buyer' && role !== 'seller')) {
                return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
            }
            if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta as number) > 50) {
                return NextResponse.json({ error: 'Điểm điều chỉnh phải từ −50 đến 50 và khác 0.' }, { status: 400 });
            }
            if (typeof note !== 'string' || note.trim().length < 10) {
                return NextResponse.json({ error: 'Lý do cần ít nhất 10 ký tự.' }, { status: 400 });
            }
            const { data, error } = await admin.rpc('record_reputation_event', {
                p_user_id: user_id,
                p_role: role,
                p_event_type: 'admin_adjust',
                p_note: note.trim().slice(0, 500),
                p_actor_id: actor.id,
                p_actor_role: actor.role,
                p_delta: delta,
            });
            if (error) throw error;
            return NextResponse.json({ success: true, recorded: data === true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update reputation';
        console.error('Admin reputation write error:', error);
        return NextResponse.json({ error: message }, { status: message === 'forbidden' ? 403 : 500 });
    }
}
