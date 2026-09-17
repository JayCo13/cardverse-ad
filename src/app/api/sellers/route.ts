import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';

type SellerVerificationRow = {
    id: string;
    user_id: string;
    full_name: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    updated_at: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
};

type SellerProfile = {
    id: string;
    display_name: string | null;
    email: string | null;
    seller_verified: boolean | null;
};

export async function GET(request: NextRequest) {
    if (!await getRole()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'all';
        const search = (searchParams.get('search') || '').trim().toLocaleLowerCase('vi');
        const page = Math.max(1, Number(searchParams.get('page')) || 1);
        const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

        if (!['all', 'pending', 'approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid seller status' }, { status: 400 });
        }

        const rows: SellerVerificationRow[] = [];
        for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase
                .from('seller_verifications')
                .select('id,user_id,full_name,status,created_at,updated_at,reviewed_at,rejection_reason')
                .order('created_at', { ascending: false })
                .range(offset, offset + 999);
            if (error) throw error;
            rows.push(...((data || []) as SellerVerificationRow[]));
            if (!data || data.length < 1000) break;
        }

        const userIds = [...new Set(rows.map((row) => row.user_id))];
        const profiles: SellerProfile[] = [];
        for (let offset = 0; offset < userIds.length; offset += 500) {
            const { data, error } = await supabase
                .from('profiles')
                .select('id,display_name,email,seller_verified')
                .in('id', userIds.slice(offset, offset + 500));
            if (error) throw error;
            profiles.push(...((data || []) as SellerProfile[]));
        }
        const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

        const sellers = rows.map((verification) => ({
            ...verification,
            user: profileById.get(verification.user_id) || null,
        }));
        const stats = {
            total: sellers.length,
            pending: sellers.filter((seller) => seller.status === 'pending').length,
            approved: sellers.filter((seller) => seller.status === 'approved').length,
            rejected: sellers.filter((seller) => seller.status === 'rejected').length,
        };

        const filtered = sellers.filter((seller) => {
            if (status !== 'all' && seller.status !== status) return false;
            if (!search) return true;
            return [seller.full_name, seller.user?.display_name, seller.user?.email, seller.user_id]
                .some((value) => value?.toLocaleLowerCase('vi').includes(search));
        });
        const start = (page - 1) * limit;

        return NextResponse.json({
            sellers: filtered.slice(start, start + limit),
            stats,
            total: filtered.length,
            page,
            totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Không thể tải danh sách seller';
        console.error('[/api/sellers GET] Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
