import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/utils/auth/getRole';
import { createAdminClient } from '@/utils/supabase/admin';

const STATUSES = ['open', 'in_progress', 'resolved'] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
    const actor = await getAdminActor();
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    try {
        const { data, error } = await createAdminClient()
            .from('contact_requests')
            .select('id, name, email, subject, message, status, user_id, created_at, updated_at')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ request: data });
    } catch (error) {
        console.error('[Contact requests] Failed to load:', error);
        return NextResponse.json({ error: 'Unable to load contact request' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const actor = await getAdminActor();
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => null) as { status?: unknown } | null;
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!STATUSES.includes(status as typeof STATUSES[number])) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { id } = await params;
    try {
        const { data, error } = await createAdminClient()
            .from('contact_requests')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('id, name, email, subject, message, status, user_id, created_at, updated_at')
            .maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ request: data });
    } catch (error) {
        console.error('[Contact requests] Failed to update:', error);
        return NextResponse.json({ error: 'Unable to update contact request' }, { status: 500 });
    }
}
