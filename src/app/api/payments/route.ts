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
    const statusFilter = searchParams.get('status') || 'all';

    try {
        const supabaseAdmin = createAdminClient();
        let query = supabaseAdmin
            .from('payment_orders')
            .select('*', { count: 'exact' });

        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        // If there is a search term, and it's a number, it might be an order_code
        if (search) {
            if (!isNaN(Number(search))) {
                query = query.eq('order_code', Number(search));
            } else {
                // If it's an email search, we have a problem because email is in auth.users
                // To properly support email search with pagination, we'd need a backend RPC or view.
                // For now, if the search isn't a number, we can't easily filter order_code.
                // We'll let the user ID be searched if it's a valid UUID
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(search)) {
                    query = query.eq('user_id', search);
                }
            }
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

        // Enrich with user emails
        const enrichedData = await Promise.all(
            (data || []).map(async (order) => {
                let userEmail = 'Unknown';
                if (order.user_id) {
                    try {
                        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
                        if (userData?.user?.email) {
                            userEmail = userData.user.email;
                        }
                    } catch (e) {
                        // ignore missing users
                    }
                }
                return {
                    ...order,
                    user_email: userEmail
                };
            })
        );

        return NextResponse.json({
            payments: enrichedData,
            total: count || 0
        }, { status: 200 });

    } catch (error: any) {
        console.error('[/api/payments GET] Caught error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
