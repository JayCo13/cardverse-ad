import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/utils/auth/getRole';
import { createAdminClient } from '@/utils/supabase/admin';

const STATUSES = ['open', 'in_progress', 'resolved'] as const;

export async function GET(request: NextRequest) {
    const actor = await getAdminActor();
    if (!actor) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requestedStatus = new URL(request.url).searchParams.get('status');
    if (requestedStatus && !STATUSES.includes(requestedStatus as typeof STATUSES[number])) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    try {
        const supabase = createAdminClient();
        let query = supabase
            .from('contact_requests')
            .select('id, name, email, subject, message, status, user_id, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(100);

        if (requestedStatus) query = query.eq('status', requestedStatus);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ requests: data || [] });
    } catch (error) {
        console.error('[Contact requests] Failed to list:', error);
        return NextResponse.json({ error: 'Unable to load contact requests' }, { status: 500 });
    }
}
