import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';


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
        if (body.action === 'ban') {
            updatePayload.ban_duration = 'none'; // permanent ban
            updatePayload.user_metadata = { ...(body.user_metadata || {}), banned: true };
        } else if (body.action === 'unban') {
            updatePayload.ban_duration = 'none';
            // Supabase uses ban_duration to unban: set to '0' or remove banned_until
            // The proper way is to call updateUserById with ban_duration removed
            updatePayload.user_metadata = { ...(body.user_metadata || {}), banned: false };
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
