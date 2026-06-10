import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

const formatVND = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// PATCH: Complete (admin transferred the money by hand) or reject (refund the
// wallet) a withdrawal request. Amounts/bank info are never taken from the
// client — everything is re-read from the DB by id.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { action, rejection_reason } = body as { action?: string; rejection_reason?: string };

        if (!id || !['complete', 'reject'].includes(action || '')) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const supabase = createAdminClient();

        if (action === 'complete') {
            // Guarded update: only pending/processing rows can complete, and the
            // affected-row check stops a double-process. The wallet was already
            // debited when the seller created the request — do NOT touch it.
            const { data: updated, error } = await supabase
                .from('wallet_withdrawals')
                .update({ status: 'completed', processed_at: new Date().toISOString() })
                .eq('id', id)
                .in('status', ['pending', 'processing'])
                .select();

            if (error) throw error;
            if (!updated || updated.length === 0) {
                return NextResponse.json({ error: 'already_processed' }, { status: 409 });
            }

            const w = updated[0];
            await supabase.from('notifications').insert({
                user_id: w.user_id,
                type: 'withdrawal_completed',
                title: '✅ Yêu cầu rút tiền đã hoàn tất',
                message: `Chúng tôi đã chuyển ${formatVND(w.amount_net)} vào tài khoản ${w.bank_name} •••${String(w.bank_account_number).slice(-4)} của bạn.`,
            });

            return NextResponse.json({ success: true });
        }

        // Reject: reason is mandatory, refund goes through the atomic RPC.
        if (!rejection_reason || !rejection_reason.trim()) {
            return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 });
        }

        const { data, error } = await supabase.rpc('refund_withdrawal', {
            p_withdrawal_id: id,
            p_reason: rejection_reason.trim(),
        });

        if (error) throw error;

        if (!data || data.ok !== true) {
            const code = data?.error;
            if (code === 'already_processed') {
                return NextResponse.json({ error: 'already_processed', status: data.status }, { status: 409 });
            }
            if (code === 'not_found') {
                return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
            }
            return NextResponse.json({ error: code || 'refund_failed' }, { status: 500 });
        }

        const { data: w } = await supabase
            .from('wallet_withdrawals')
            .select('user_id, amount_requested')
            .eq('id', id)
            .single();

        if (w) {
            await supabase.from('notifications').insert({
                user_id: w.user_id,
                type: 'withdrawal_rejected',
                title: '❌ Yêu cầu rút tiền bị từ chối',
                message: `Lý do: ${rejection_reason.trim()}. ${formatVND(w.amount_requested)} đã được hoàn lại vào ví của bạn.`,
            });
        }

        return NextResponse.json({ success: true, new_balance: data.new_balance });
    } catch (error: any) {
        console.error('[/api/withdrawals/[id] PATCH] error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
