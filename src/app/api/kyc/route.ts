import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendKYCApproved, sendKYCRejected } from '@/utils/mail/kyc-notifications';

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
    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';

        const { data, error } = await supabase
            .from('seller_verifications')
            .select(`
                *,
                scan:kyc_verification_scans!ai_scan_id (
                    cccd_id_number,
                    cccd_dob
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
            user: profileMap.get(v.user_id) || null,
        }));

        return NextResponse.json({ verifications });
    } catch (error: any) {
        console.error('Admin KYC list error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Approve or reject a verification
export async function PATCH(request: NextRequest) {
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

        if (action === 'approve') {
            // Update verification status
            await supabase
                .from('seller_verifications')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', verification_id);

            // Update user profile
            await supabase
                .from('profiles')
                .update({ seller_verified: true })
                .eq('id', verification.user_id);

            // Notify user via in-app notification
            await supabase.from('notifications').insert({
                user_id: verification.user_id,
                type: 'kyc_approved',
                title: '✅ Xác minh đã được duyệt!',
                message: 'Tài khoản của bạn đã được xác minh. Bạn có thể bắt đầu đăng bán thẻ ngay!',
            });

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
            await supabase
                .from('seller_verifications')
                .update({
                    status: 'rejected',
                    rejection_reason: rejection_reason || 'Không đạt yêu cầu',
                    reviewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', verification_id);

            // Notify user via in-app notification
            await supabase.from('notifications').insert({
                user_id: verification.user_id,
                type: 'kyc_rejected',
                title: '❌ Xác minh bị từ chối',
                message: `Lý do: ${rejection_reason || 'Không đạt yêu cầu'}. Bạn có thể gửi lại.`,
            });

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
