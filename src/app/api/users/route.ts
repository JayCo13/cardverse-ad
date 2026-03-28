import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';


export async function GET(request: Request) {
    const role = await getRole();

    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated to list users.' }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[/api/users GET] SUPABASE_SERVICE_ROLE_KEY is not set in .env.local!');
        return NextResponse.json({ error: 'Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY in .env.local' }, { status: 500 });
    }

    const searchParams = new URL(request.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('limit') || '10', 10);
    const searchParam = searchParams.get('search') || '';
    const filterParam = searchParams.get('filter') || 'all';

    try {
        const supabaseAdmin = createAdminClient();
        let allUsers: any[] = [];
        let total = 0;

        // When the viewer is an admin (not moderator), they should only see regular users
        const isAdminViewer = role === 'admin';

        if (searchParam || filterParam !== 'all' || isAdminViewer) {
            // Fetch a large block of users to filter in memory when a specific query is applied
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (error) {
                console.error('[/api/users GET] Supabase error:', error.message);
                throw error;
            }

            let filtered = data.users;

            // Apply text search
            if (searchParam) {
                const s = searchParam.toLowerCase();
                filtered = filtered.filter(u => u.email?.toLowerCase().includes(s) || u.id.toLowerCase().includes(s));
            }

            // Apply selected dropdown filter
            if (filterParam === 'active_30') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                filtered = filtered.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > thirtyDaysAgo);
            } else if (filterParam === 'new_30') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                filtered = filtered.filter(u => new Date(u.created_at) > thirtyDaysAgo);
            } else if (filterParam === 'never_signed_in') {
                filtered = filtered.filter(u => !u.last_sign_in_at);
            } else if (filterParam === 'role_admin') {
                filtered = filtered.filter(u => u.app_metadata?.role === 'admin');
            } else if (filterParam === 'role_user') {
                filtered = filtered.filter(u => !u.app_metadata?.role || u.app_metadata?.role !== 'admin');
            }

            // If the viewer is an admin (not mod), hide other admins from the list
            if (isAdminViewer) {
                filtered = filtered.filter(u => u.app_metadata?.role !== 'admin');
            }

            total = filtered.length;

            // Apply manual pagination to the filtered array
            const startIndex = (page - 1) * perPage;
            const endIndex = startIndex + perPage;
            allUsers = filtered.slice(startIndex, endIndex);

        } else {
            // Standard paginated fetch
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({
                page,
                perPage
            });

            if (error) {
                console.error('[/api/users GET] Supabase error:', error.message);
                throw error;
            }

            allUsers = data.users;
            total = (data as any).total || data.users.length;
        }

        return NextResponse.json({
            users: allUsers,
            total,
            viewerRole: role
        }, { status: 200 });
    } catch (error: any) {
        console.error('[/api/users GET] Caught error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const role = await getRole();
    if (role !== 'moderator') {
        return NextResponse.json({ error: 'Forbidden. Only Moderators can create admin accounts.' }, { status: 403 });
    }

    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // Create a new user with auto-confirm enabled so they can log in immediately
        const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            app_metadata: { role: 'admin' }
        });

        if (error) throw error;

        return NextResponse.json({ user }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
