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
        const isAdminViewer = role === 'admin';

        // Fetch user list (up to 1000) for global stats, filtering, and accurate pagination
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (error) {
            console.error('[/api/users GET] Supabase error:', error.message);
            throw error;
        }

        const rawUsers = data?.users || [];

        // Calculate global statistics across users (before search/filter)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();

        const baseStatsUsers = isAdminViewer
            ? rawUsers.filter(u => u.app_metadata?.role !== 'admin')
            : rawUsers;

        const stats = {
            total: baseStatsUsers.length,
            newToday: baseStatsUsers.filter(u => new Date(u.created_at).getTime() >= startOfToday).length,
            new7d: baseStatsUsers.filter(u => new Date(u.created_at).getTime() >= sevenDaysAgo).length,
            new30d: baseStatsUsers.filter(u => new Date(u.created_at).getTime() >= thirtyDaysAgo).length,
            active30d: baseStatsUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= thirtyDaysAgo).length,
            neverActive: baseStatsUsers.filter(u => !u.last_sign_in_at).length,
            admins: rawUsers.filter(u => u.app_metadata?.role === 'admin').length,
        };

        let filtered = [...rawUsers];

        // If the viewer is an admin (not mod), hide other admins from the list
        if (isAdminViewer) {
            filtered = filtered.filter(u => u.app_metadata?.role !== 'admin');
        }

        // Apply text search
        if (searchParam) {
            const s = searchParam.toLowerCase();
            filtered = filtered.filter(u => u.email?.toLowerCase().includes(s) || u.id.toLowerCase().includes(s));
        }

        // Apply selected dropdown / card filter
        if (filterParam === 'new_today') {
            filtered = filtered.filter(u => new Date(u.created_at).getTime() >= startOfToday);
        } else if (filterParam === 'new_7') {
            filtered = filtered.filter(u => new Date(u.created_at).getTime() >= sevenDaysAgo);
        } else if (filterParam === 'new_30') {
            filtered = filtered.filter(u => new Date(u.created_at).getTime() >= thirtyDaysAgo);
        } else if (filterParam === 'active_30') {
            filtered = filtered.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= thirtyDaysAgo);
        } else if (filterParam === 'never_signed_in') {
            filtered = filtered.filter(u => !u.last_sign_in_at);
        } else if (filterParam === 'role_admin') {
            filtered = filtered.filter(u => u.app_metadata?.role === 'admin');
        } else if (filterParam === 'role_user') {
            filtered = filtered.filter(u => !u.app_metadata?.role || u.app_metadata?.role !== 'admin');
        }

        // Always sort by created_at desc (newest users first)
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const total = filtered.length;
        const startIndex = (page - 1) * perPage;
        const paginatedUsers = filtered.slice(startIndex, startIndex + perPage);

        return NextResponse.json({
            users: paginatedUsers,
            total,
            stats,
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
