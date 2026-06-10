import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

// GET: List seller withdrawal requests, filtered by status.
export async function GET(request: NextRequest) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';

        const { data, error } = await supabase
            .from('wallet_withdrawals')
            .select('*')
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Attach seller profile info (FK points at profiles, but join manually
        // to stay consistent with the other admin list routes).
        const userIds = [...new Set((data || []).map((w: any) => w.user_id))];
        const { data: profiles } = userIds.length > 0
            ? await supabase.from('profiles').select('id, email, display_name').in('id', userIds)
            : { data: [] };

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const withdrawals = (data || []).map((w: any) => ({
            ...w,
            user: profileMap.get(w.user_id) || null,
        }));

        return NextResponse.json({ withdrawals });
    } catch (error: any) {
        console.error('[/api/withdrawals GET] error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
