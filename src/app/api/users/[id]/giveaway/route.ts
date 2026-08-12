import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getAdminActor } from '@/utils/auth/getRole';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const actor = await getAdminActor();
    if (!actor) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const { id: userId } = await params;
        const { packageType } = await request.json();
        const idempotencyKey = request.headers.get('idempotency-key');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const validTypes = ['day_pass', 'credit_pack', 'vip_pro'];
        if (!validTypes.includes(packageType)) {
            return NextResponse.json({ error: 'Invalid package type. Must be one of: day_pass, credit_pack, vip_pro' }, { status: 400 });
        }
        if (!idempotencyKey || !UUID_PATTERN.test(idempotencyKey)) {
            return NextResponse.json({ error: 'Valid Idempotency-Key is required' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // Verify the target user exists
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { data, error: grantError } = await supabaseAdmin.rpc(
            'grant_admin_subscription_package',
            {
                p_user_id: userId,
                p_package_type: packageType,
                p_actor_id: actor.id,
                p_actor_role: actor.role,
                p_idempotency_key: idempotencyKey,
            }
        );
        if (grantError) throw grantError;
        const result = data as { subscription?: unknown; replayed?: boolean } | null;
        return NextResponse.json(
            { subscription: result?.subscription, replayed: !!result?.replayed },
            { status: result?.replayed ? 200 : 201 },
        );

    } catch (error: any) {
        console.error('[/api/users/[id]/giveaway] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
