import { NextResponse } from 'next/server';
import { getAdminActor } from '@/utils/auth/getRole';
import { createAdminClient } from '@/utils/supabase/admin';

const ACTIONS = new Set([
  'verify_for_transfer',
  'start_transfer',
  'release_claim',
  'complete',
  'reject',
  'mark_transfer_failed',
  'record_returned',
  'resolve_legacy',
  'takeover_recovery',
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminActor();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_wallet_withdrawal_statement', {
    p_withdrawal_id: id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });

  // The RPC contract intentionally contains masked destinations only. Never
  // enrich this GET with wallet_withdrawals.bank_account_number.
  return NextResponse.json({ ...data, actor_role: actor.role }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminActor();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await params;
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
      return NextResponse.json({ error: 'Idempotency-Key is required' }, { status: 400 });
    }

    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : '';
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (action === 'mark_transfer_failed' || action === 'record_returned' || action === 'takeover_recovery') {
      if (actor.role !== 'moderator') {
        return NextResponse.json({ error: 'Moderator role required' }, { status: 403 });
      }
    }

    const payload = action === 'reject'
      ? { reason: body.reason || body.rejection_reason }
      : body.payload || {
        transfer_reference: body.transfer_reference,
        return_reference: body.return_reference,
        reason: body.reason,
        evidence: body.evidence,
        outcome: body.outcome,
      };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('perform_withdrawal_action', {
      p_withdrawal_id: id,
      p_action: action,
      p_idempotency_key: idempotencyKey,
      p_actor_id: actor.id,
      p_actor_role: actor.role,
      p_payload: payload,
    });
    if (error) throw error;
    if (!data?.ok) {
      const code = data?.error || 'action_failed';
      const status = code === 'not_found' ? 404
        : code.includes('forbidden') ? 403
          : code.includes('conflict') || code.includes('mismatch') || code.includes('not_') ? 409
            : 400;
      return NextResponse.json({ error: code, ...data }, { status });
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[/api/withdrawals/[id]]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
