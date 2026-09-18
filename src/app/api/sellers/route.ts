import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRole } from '@/utils/auth/getRole';
import {
    computeSellerProgress,
    type ProgressBlock,
    type ProgressKycSession,
    type ProgressProfile,
    type SellerProgress,
} from '@/utils/sellerProgress';

type SellerVerificationRow = {
    id: string;
    user_id: string;
    full_name: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    updated_at: string | null;
    reviewed_at: string | null;
    reviewed_by_actor: string | null;
    rejection_reason: string | null;
    auto_approved: boolean | null;
    bank_verified_at: string | null;
    bank_account_name_verified: string | null;
};

type KycSessionRow = ProgressKycSession & { user_id: string };
type BlockRow = ProgressBlock & { user_id: string };

type SellerProfile = ProgressProfile & {
    id: string;
    display_name: string | null;
    email: string | null;
    seller_verified: boolean | null;
};

type SellerListStatus = 'verifying' | 'pending' | 'approved' | 'rejected';

type SellerListItem = {
    id: string;
    user_id: string;
    full_name: string;
    status: SellerListStatus;
    created_at: string;
    updated_at: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    user: SellerProfile | null;
    progress: SellerProgress;
};

const VALID_STATUS = ['all', 'verifying', 'pending', 'approved', 'rejected'];

async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await query(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
    }
    return rows;
}

export async function GET(request: NextRequest) {
    if (!await getRole()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const supabase = createAdminClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'all';
        const search = (searchParams.get('search') || '').trim().toLocaleLowerCase('vi');
        const page = Math.max(1, Number(searchParams.get('page')) || 1);
        const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

        if (!VALID_STATUS.includes(status)) {
            return NextResponse.json({ error: 'Invalid seller status' }, { status: 400 });
        }

        const [verifications, kycSessions, blocks] = await Promise.all([
            fetchAll<SellerVerificationRow>((from, to) => supabase
                .from('seller_verifications')
                .select('id,user_id,full_name,status,created_at,updated_at,reviewed_at,reviewed_by_actor,rejection_reason,auto_approved,bank_verified_at,bank_account_name_verified')
                .order('created_at', { ascending: false })
                .range(from, to)),
            fetchAll<KycSessionRow>((from, to) => supabase
                .from('kyc_sessions')
                .select('user_id,status,consumed_at,created_at')
                .order('created_at', { ascending: false })
                .range(from, to)),
            fetchAll<BlockRow>((from, to) => supabase
                .from('seller_verification_blocks')
                .select('user_id,matched_axis,created_at')
                .order('created_at', { ascending: false })
                .range(from, to)),
        ]);

        // Rows come back newest-first, so the first one seen per user is the latest.
        const verificationByUser = new Map<string, SellerVerificationRow>();
        for (const row of verifications) if (!verificationByUser.has(row.user_id)) verificationByUser.set(row.user_id, row);
        const kycByUser = new Map<string, KycSessionRow>();
        for (const row of kycSessions) if (!kycByUser.has(row.user_id)) kycByUser.set(row.user_id, row);
        const blockByUser = new Map<string, BlockRow>();
        for (const row of blocks) if (!blockByUser.has(row.user_id)) blockByUser.set(row.user_id, row);

        const userIds = [...new Set([...verificationByUser.keys(), ...kycByUser.keys(), ...blockByUser.keys()])];
        const profiles: SellerProfile[] = [];
        for (let offset = 0; offset < userIds.length; offset += 500) {
            const { data, error } = await supabase
                .from('profiles')
                .select('id,display_name,email,seller_verified,address_province_id,address_ward_code')
                .in('id', userIds.slice(offset, offset + 500));
            if (error) throw error;
            profiles.push(...((data || []) as SellerProfile[]));
        }
        const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

        const sellers: SellerListItem[] = verifications.map((verification) => ({
            ...verification,
            user: profileById.get(verification.user_id) || null,
            progress: computeSellerProgress({
                verification,
                kycSession: kycByUser.get(verification.user_id) || null,
                block: blockByUser.get(verification.user_id) || null,
                profile: profileById.get(verification.user_id) || null,
            }),
        }));

        // Users who started eKYC (or got hard-blocked) but never reached a
        // seller_verifications row — surfaced so admins can see where they stalled.
        for (const userId of userIds) {
            if (verificationByUser.has(userId)) continue;
            const kycSession = kycByUser.get(userId) || null;
            const block = blockByUser.get(userId) || null;
            const startedAt = [kycSession?.created_at, block?.created_at].filter(Boolean).sort().at(-1) as string;
            sellers.push({
                id: `kyc:${userId}`,
                user_id: userId,
                full_name: '',
                status: 'verifying',
                created_at: startedAt,
                updated_at: null,
                reviewed_at: null,
                rejection_reason: null,
                user: profileById.get(userId) || null,
                progress: computeSellerProgress({ verification: null, kycSession, block, profile: profileById.get(userId) || null }),
            });
        }
        sellers.sort((a, b) => b.created_at.localeCompare(a.created_at));

        const stats = {
            total: sellers.length,
            verifying: sellers.filter((seller) => seller.status === 'verifying').length,
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
