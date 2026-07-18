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
            const { data, error } = await supabase.rpc('complete_wallet_withdrawal', {
                p_withdrawal_id: id,
            });

            if (error) throw error;
            if (!data?.ok) {
                if (data?.error === 'already_processed') {
                    return NextResponse.json({ error: 'already_processed', status: data.status }, { status: 409 });
                }
                if (data?.error === 'not_found') {
                    return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
                }
                return NextResponse.json({ error: data?.error || 'completion_failed' }, { status: 500 });
            }

            await supabase.from('notifications').insert({
                user_id: data.user_id,
                type: 'withdrawal_completed',
                title: '✅ Yêu cầu rút tiền đã hoàn tất',
                message: `Chúng tôi đã chuyển ${formatVND(data.amount_net)} vào tài khoản ${data.bank_name} •••${String(data.bank_account_number).slice(-4)} của bạn.`,
            });

            return NextResponse.json({ success: true });
        }

        // Reject: release held funds through the atomic RPC.
        if (!rejection_reason || !rejection_reason.trim()) {
            return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 });
        }

        const { data, error } = await supabase.rpc('reject_wallet_withdrawal', {
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

        await supabase.from('notifications').insert({
            user_id: data.user_id,
            type: 'withdrawal_rejected',
            title: '❌ Yêu cầu rút tiền bị từ chối',
            message: `Lý do: ${rejection_reason.trim()}. ${formatVND(data.amount_requested)} đã được trả lại số dư khả dụng.`,
        });

        return NextResponse.json({ success: true, new_balance: data.new_balance });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[/api/withdrawals/[id] PATCH] error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
