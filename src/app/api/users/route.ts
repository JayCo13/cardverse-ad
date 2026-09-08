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
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 10));
    const searchParam = searchParams.get('search') || '';
    const filterParam = searchParams.get('filter') || 'all';

    try {
        const supabaseAdmin = createAdminClient();
        const isAdminViewer = role === 'admin';

        const rawUsers: import('@supabase/supabase-js').User[] = [];
        for (let authPage = 1; ; authPage++) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: authPage, perPage: 1000 });
            if (error) throw error;
            rawUsers.push(...data.users);
            if (data.users.length < 1000) break;
        }
        const restrictions = new Map<string, { is_banned: boolean; version: number; reason: string | null }>();
        // Supabase caps results per request. Page state rows too.
        for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabaseAdmin.from('account_restrictions').select('*').order('user_id').range(offset, offset + 999);
            if (error) throw error;
            for (const row of data || []) restrictions.set(row.user_id, row);
            if (!data || data.length < 1000) break;
        }
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
        if (filterParam === 'banned') {
            filtered = filtered.filter(u => restrictions.get(u.id)?.is_banned);
        } else if (filterParam === 'legacy_ban') {
            filtered = filtered.filter(u => u.user_metadata?.banned || (u.banned_until && new Date(u.banned_until).getTime() > Date.now()));
        } else if (filterParam === 'new_today') {
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

        const users = await Promise.all(paginatedUsers.map(async user => {
            const [orders, withdrawals] = await Promise.all([
                supabaseAdmin.from('orders').select('id', { count: 'exact', head: true })
                    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).not('status', 'in', '(completed,refunded,cancelled)'),
                supabaseAdmin.from('wallet_withdrawals').select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id).not('status', 'in', '(completed,rejected,cancelled)'),
            ]);
            if (orders.error || withdrawals.error) throw orders.error || withdrawals.error;
            return { ...user, restriction: restrictions.get(user.id) || { is_banned: false, version: 0 },
                legacy_ban: !!user.user_metadata?.banned || !!(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
                impact: { orders: orders.count || 0, withdrawals: withdrawals.count || 0 } };
        }));
        return NextResponse.json({
            users,
            restrictionsEnabled: process.env.ACCOUNT_RESTRICTIONS_ENABLED === 'true',
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
