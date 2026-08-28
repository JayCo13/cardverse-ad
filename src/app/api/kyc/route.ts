import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendKYCApproved, sendKYCRejected } from '@/utils/mail/kyc-notifications';
import { getRole, getAdminActor } from '@/utils/auth/getRole';

// Resolve a user's email reliably. The profiles row may be missing or have an
// empty email (the seller_verifications FK points at auth.users, not profiles),
// so fall back to auth.users — which always has the account email.
async function resolveUserEmail(
    supabase: ReturnType<typeof createAdminClient>,
    userId: string
): Promise<string | null> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();
    if (profile?.email) return profile.email as string;

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    return authUser?.user?.email ?? null;
}

// GET: List all KYC verification requests
export async function GET(request: NextRequest) {
    if (!await getRole()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';

        // `scan` is only populated for rows predating the provider migration;
        // `kyc_session` carries the identity attested by the provider.
        const { data, error } = await supabase
            .from('seller_verifications')
            .select(`
                *,
                scan:kyc_verification_scans!ai_scan_id (
                    cccd_id_number,
                    cccd_dob
                ),
                kyc_session:kyc_sessions!kyc_session_id (
                    provider,
                    provider_session_id,
                    status,
                    verified_full_name,
                    verified_dob,
                    verified_document_type,
                    liveness_score,
                    face_match_score,
                    nfc_verified,
                    warnings
                )
            `)
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch associated profiles manually since FK is on auth.users not profiles
        const userIds = (data || []).map((v: any) => v.user_id);
        const { data: profiles } = userIds.length > 0
            ? await supabase.from('profiles').select('id, email, display_name, profile_image_url').in('id', userIds)
            : { data: [] };

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const verifications = (data || []).map((v: any) => ({
            ...v,
            bank_account_number: typeof v.bank_account_number === 'string'
                ? `••••${v.bank_account_number.slice(-4)}`
                : null,
            user: profileMap.get(v.user_id) || null,
        }));

        return NextResponse.json({ verifications }, {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    } catch (error: any) {
        console.error('Admin KYC list error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Approve or reject a verification
//
// The consumer app now auto-approves clean submissions and hard-blocks reused
// identities before they ever reach this queue, so this path mostly handles
// legacy rows and the KYC_AUTO_APPROVE=false kill switch. It is still the one
// place a human can mint a seller, so it re-checks everything the automated
// path checks.
export async function PATCH(request: NextRequest) {
    const actor = await getAdminActor();
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const supabase = createAdminClient();
        const body = await request.json();
        const { verification_id, action, rejection_reason } = body;

        if (!verification_id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // Get verification
        const { data: verification, error: getError } = await supabase
            .from('seller_verifications')
            .select('*')
            .eq('id', verification_id)
            .single();

        if (getError || !verification) {
            return NextResponse.json({ error: 'Verification not found' }, { status: 404 });
        }

        const now = new Date().toISOString();
        // A moderator is not a Supabase user, so its id is not a uuid and can
        // only go in the text column.
        const reviewerColumns = {
            reviewed_by: actor.role === 'admin' ? actor.id : null,
            reviewed_by_actor: actor.id,
        };

        if (action === 'approve') {
            // `.eq('status', 'pending')` makes this idempotent: a double-click or
            // a replayed request updates nothing the second time, so the user is
            // not re-approved and does not get a second email.
            const { data: approved, error: approveError } = await supabase
                .from('seller_verifications')
                .update({
                    status: 'approved',
                    ...reviewerColumns,
                    reviewed_at: now,
                    updated_at: now,
                })
                .eq('id', verification_id)
                .eq('status', 'pending')
                .select('id');

            if (approveError) {
                // The partial unique indexes from
                // 20260828000200_seller_duplicate_hard_block.sql refuse to let a
                // second live row hold the same document or payout account.
                if ((approveError as { code?: string }).code === '23505') {
                    return NextResponse.json({
                        error: 'Hồ sơ này trùng giấy tờ hoặc số tài khoản ngân hàng với một tài khoản khác đã được duyệt. '
                             + 'Hãy từ chối hồ sơ cũ trước nếu muốn chuyển sang tài khoản này.',
                    }, { status: 409 });
                }
                throw approveError;
            }
            if (!approved || approved.length === 0) {
                return NextResponse.json({ error: 'Hồ sơ không còn ở trạng thái chờ duyệt.' }, { status: 409 });
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .update({ seller_verified: true })
                .eq('id', verification.user_id);
            // Not fatal on its own, but it means the user is approved without
            // the flag the UI reads — worth shouting about rather than swallowing.
            if (profileError) console.error('[Admin KYC] Failed to set seller_verified:', profileError);

            const { error: notifyError } = await supabase.from('notifications').insert({
                user_id: verification.user_id,
                type: 'kyc_approved',
                title: '✅ Xác minh đã được duyệt!',
                message: 'Tài khoản của bạn đã được xác minh. Bạn có thể bắt đầu đăng bán thẻ ngay!',
            });
            if (notifyError) console.error('[Admin KYC] Failed to insert notification:', notifyError);

            // Send email notification
            const email = await resolveUserEmail(supabase, verification.user_id);
            if (email) {
                // Must await: on serverless the function is frozen once the response
                // returns, which would kill an un-awaited SMTP send mid-flight.
                await sendKYCApproved(email, (verification as any).full_name);
            } else {
                console.warn(`[Admin KYC] No email found for user ${verification.user_id}; approval email skipped.`);
            }

        } else {
            // Reject
            const { data: rejected, error: rejectError } = await supabase
                .from('seller_verifications')
                .update({
                    status: 'rejected',
                    rejection_reason: rejection_reason || 'Không đạt yêu cầu',
                    ...reviewerColumns,
                    reviewed_at: now,
                    updated_at: now,
                })
                .eq('id', verification_id)
                .neq('status', 'rejected')
                .select('id');

            if (rejectError) throw rejectError;
            if (!rejected || rejected.length === 0) {
                return NextResponse.json({ error: 'Hồ sơ đã bị từ chối trước đó.' }, { status: 409 });
            }

            // Rejecting a previously approved seller must also take the listing
            // right away, otherwise they keep selling with a revoked profile.
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ seller_verified: false })
                .eq('id', verification.user_id);
            if (profileError) console.error('[Admin KYC] Failed to clear seller_verified:', profileError);

            const { error: notifyError } = await supabase.from('notifications').insert({
                user_id: verification.user_id,
                type: 'kyc_rejected',
                title: '❌ Xác minh bị từ chối',
                message: `Lý do: ${rejection_reason || 'Không đạt yêu cầu'}. Bạn có thể gửi lại.`,
            });
            if (notifyError) console.error('[Admin KYC] Failed to insert notification:', notifyError);

            // Send email notification
            const email = await resolveUserEmail(supabase, verification.user_id);
            if (email) {
                // Must await — see note in the approve branch.
                await sendKYCRejected(email, (verification as any).full_name, rejection_reason || 'Không đạt yêu cầu');
            } else {
                console.warn(`[Admin KYC] No email found for user ${verification.user_id}; rejection email skipped.`);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Admin KYC action error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
