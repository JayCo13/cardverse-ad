import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const { id: userId } = await params;
        const { packageType } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const validTypes = ['day_pass', 'credit_pack', 'vip_pro'];
        if (!validTypes.includes(packageType)) {
            return NextResponse.json({ error: 'Invalid package type. Must be one of: day_pass, credit_pack, vip_pro' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // Verify the target user exists
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const now = new Date();
        let expiresAt: string | null = null;
        let scanCredits: number | null = null;

        if (packageType === 'day_pass') {
            const expires = new Date(now);
            expires.setHours(expires.getHours() + 24);
            expiresAt = expires.toISOString();
        } else if (packageType === 'vip_pro') {
            const expires = new Date(now);
            expires.setDate(expires.getDate() + 30);
            expiresAt = expires.toISOString();
        } else if (packageType === 'credit_pack') {
            scanCredits = 100;
        }

        const { data: subscription, error: insertError } = await supabaseAdmin
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                package_type: packageType,
                status: 'active',
                starts_at: now.toISOString(),
                expires_at: expiresAt,
                scan_credits_remaining: scanCredits,
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Giveaway] Insert error:', insertError);
            throw insertError;
        }

        return NextResponse.json({ subscription }, { status: 201 });

    } catch (error: any) {
        console.error('[/api/users/[id]/giveaway] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
