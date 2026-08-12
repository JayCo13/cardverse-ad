import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

export async function GET(request: NextRequest) {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const admin = createAdminClient();
    await Promise.all([
      admin.rpc('recover_expired_withdrawal_claims'),
      admin.rpc('flag_stale_withdrawal_transfers'),
    ]);

    const filter = request.nextUrl.searchParams.get('status') || 'pending';
    let query = admin
      .from('wallet_withdrawals')
      .select(`
        id, user_id, amount_requested, fee, amount_net, currency, status,
        funding_state, bank_name, bank_account_name, bank_account_masked,
        created_at, processed_at, processing_expires_at, transfer_started_at,
        recovery_required, recovery_reason
      `)
      .order('created_at', { ascending: false });

    if (filter === 'recovery') {
      query = query.eq('recovery_required', true);
    } else if (filter === 'legacy') {
      query = query.in('funding_state', [
        'legacy_blocked',
        'legacy_transfer_review_required',
        'legacy_underfunded',
      ]);
    } else {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) throw error;
    const userIds = [...new Set((data || []).map((row) => row.user_id))];
    const { data: profiles } = userIds.length
      ? await admin.from('profiles').select('id, email, display_name').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return NextResponse.json({
      withdrawals: (data || []).map((withdrawal) => ({
        ...withdrawal,
        bank_account_masked: withdrawal.bank_account_masked || '••••',
        user: profileMap.get(withdrawal.user_id) || null,
      })),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
