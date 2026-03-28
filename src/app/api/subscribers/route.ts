import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

export async function GET(request: Request) {
    const role = await getRole();
    if (!role) {
        return NextResponse.json({ error: 'Forbidden. You must be authenticated.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';

    try {
        const supabaseAdmin = createAdminClient();
        let query = supabaseAdmin
            .from('newsletter_subscribers')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.ilike('email', `%${search}%`);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

        return NextResponse.json({
            subscribers: data || [],
            total: count || 0
        }, { status: 200 });

    } catch (error: any) {
        console.error('[/api/subscribers GET] Caught error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
