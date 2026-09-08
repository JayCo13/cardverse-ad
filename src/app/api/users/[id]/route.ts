import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole, getAdminActor } from '@/utils/auth/getRole';


export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = await getRole();
    if (role !== 'moderator') {
        return NextResponse.json({ error: 'Forbidden. Only Moderators can delete accounts.' }, { status: 403 });
    }

    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (error) throw error;

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const body = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();
        const updatePayload: any = {};

        // Ban/Unban: available to both moderator and admin
        if (body.action === 'ban' || body.action === 'unban') {
            if (process.env.ACCOUNT_RESTRICTIONS_ENABLED !== 'true') {
                return NextResponse.json({ error: 'Ban/unban is awaiting integration verification.' }, { status: 503 });
            }
            const actor = await getAdminActor();
            if (!actor || actor.id === id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
            const key = request.headers.get('Idempotency-Key');
            if (reason.length < 10 || reason.length > 1000 || !Number.isSafeInteger(body.expected_version)
                || body.expected_version < 0 || !key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
                return NextResponse.json({ error: 'Reason must contain 10–1000 characters; version and Idempotency-Key are required.' }, { status: 400 });
            }
            const { data, error } = await supabaseAdmin.rpc('set_account_restriction', {
                p_user_id: id, p_action: body.action, p_reason: reason,
                p_expected_version: body.expected_version, p_key: key,
                p_actor_id: actor.id, p_actor_role: actor.role,
            });
            if (error) {
                const status = ['version_conflict', 'idempotency_conflict'].includes(error.message) ? 409
                    : error.message === 'forbidden' ? 403 : error.message === 'user_not_found' ? 404 : 400;
                return NextResponse.json({ error: error.message }, { status });
            }
            return NextResponse.json({ restriction: data });
        } else if (body.action === 'set_role') {
            // Promote an existing user to admin (or revoke): moderator only.
            // The user keeps their existing credentials and can log into the
            // admin panel with the account they already have.
            if (role !== 'moderator') {
                return NextResponse.json({ error: 'Forbidden. Only Moderators can change user roles.' }, { status: 403 });
            }
            // app_metadata is shallow-merged by Supabase; set role to null to revoke.
            updatePayload.app_metadata = { role: body.role === 'admin' ? 'admin' : null };
        } else {
            // Password reset & metadata updates: moderator only
            if (role !== 'moderator') {
                return NextResponse.json({ error: 'Forbidden. Only Moderators can update account credentials.' }, { status: 403 });
            }
            if (body.password) updatePayload.password = body.password;
            if (body.user_metadata) updatePayload.user_metadata = body.user_metadata;
        }

        const { data: { user }, error } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);

        if (error) throw error;

        return NextResponse.json({ user }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
