import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

/**
 * Attempts that were refused outright because the document or the payout
 * account already belongs to another account.
 *
 * These never become a `seller_verifications` row, so without this endpoint a
 * blocked user simply disappears and support has no way to answer "why can't I
 * sell?". Read-only by design: unblocking is done by rejecting the *other*
 * account's verification, which frees the partial unique index.
 */
export async function GET(request: NextRequest) {
    if (!await getRole()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Number(searchParams.get('limit')) || 100, 200);

        const { data, error } = await supabase
            .from('seller_verification_blocks')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // The FK points at auth.users, not profiles — same reason the main KYC
        // list fetches profiles separately.
        const userIds = [...new Set((data || []).flatMap((b: any) => [
            b.user_id,
            ...((b.matched_user_ids as string[] | null) || []),
        ]))];

        const { data: profiles } = userIds.length > 0
            ? await supabase.from('profiles').select('id, email, display_name').in('id', userIds)
            : { data: [] };

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        const blocks = (data || []).map((b: any) => ({
            id: b.id,
            matched_axis: b.matched_axis,
            created_at: b.created_at,
            // Never return the full payout destination from a list endpoint.
            bank_account_number: typeof b.bank_account_number === 'string'
                ? `••••${b.bank_account_number.slice(-4)}`
                : null,
            user: profileMap.get(b.user_id) || { id: b.user_id },
            // Who they collided with — admin-only, and the reason this row is
            // actionable: rejecting that account's verification unblocks this one.
            matched_users: ((b.matched_user_ids as string[] | null) || [])
                .map((id) => profileMap.get(id) || { id }),
        }));

        return NextResponse.json({ blocks }, {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    } catch (error: any) {
        console.error('Admin KYC blocked list error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
