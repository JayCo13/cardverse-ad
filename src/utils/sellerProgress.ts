/**
 * Derives the seller-verification progress shown on /sellers from the raw
 * rows the admin API already reads. Kept pure so the API computes it once
 * and the client only renders it.
 *
 * Step order mirrors the consumer /sell wizard:
 *   identity (Didit eKYC) → bank (NAPAS lookup) → submit → review
 *   → shop (pickup address + carriers) → listing (first card posted)
 */

export type StepKey = 'identity' | 'bank' | 'submit' | 'review' | 'shop' | 'listing';
export type StepState = 'done' | 'current' | 'failed' | 'upcoming';

export type SellerStage =
    | 'not_started'
    | 'identity_in_progress'
    | 'identity_review'
    | 'identity_failed'
    | 'identity_approved'
    | 'blocked'
    | 'pending'
    | 'rejected'
    | 'approved'
    | 'ready'
    | 'listed';

export type SellerProgressStep = {
    key: StepKey;
    label: string;
    state: StepState;
    detail?: string;
};

export type SellerProgress = {
    steps: SellerProgressStep[];
    stage: SellerStage;
    stageLabel: string;
    detail?: string;
};

export type ProgressVerification = {
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_at: string | null;
    reviewed_by_actor: string | null;
    rejection_reason: string | null;
    auto_approved: boolean | null;
    bank_verified_at: string | null;
    bank_account_name_verified: string | null;
};

export type ProgressKycSession = {
    status: string;
    consumed_at: string | null;
    created_at: string;
};

export type ProgressBlock = {
    matched_axis: 'document' | 'bank' | 'both';
    created_at: string;
};

export type ProgressProfile = {
    address_province_id: number | null;
    address_ward_code: string | null;
    shipping_carriers: string[] | null;
    carrier_coverage: { carriers?: string[] | null } | null;
};

export type ProgressListings = {
    total: number;
    active: number;
};

// Mirror of cardverse-web/src/lib/shipping-carriers.ts — couriers a shop may
// tick, and how many it needs before it can sell (a backup for route swaps).
const OFFERABLE_COURIERS = ['ghn', 'shopee', 'best', 'jnt'];
const MIN_SHOP_CARRIERS = 2;

function minShopCarriers(collecting: string[] | null | undefined): number {
    const available = Array.isArray(collecting)
        ? OFFERABLE_COURIERS.filter((code) => collecting.includes(code)).length
        : OFFERABLE_COURIERS.length;
    return Math.max(1, Math.min(MIN_SHOP_CARRIERS, available));
}

/** Same gate as /sell/create: pickup address saved and enough bookable couriers ticked. */
export function shopReadiness(profile: ProgressProfile | null): { address: boolean; shipping: boolean; carriers: string[]; required: number } {
    const address = Boolean(profile?.address_province_id && profile?.address_ward_code);
    const collecting = profile?.carrier_coverage?.carriers ?? null;
    const carriers = (profile?.shipping_carriers ?? []).filter((code) =>
        OFFERABLE_COURIERS.includes(code) && (collecting === null || collecting.includes(code)));
    const required = minShopCarriers(collecting);
    return { address, shipping: carriers.length >= required, carriers, required };
}

// Didit vocabulary — keep in sync with cardverse-web/src/lib/kyc/types.ts
const KYC_IN_FLIGHT = new Set(['Not Started', 'In Progress', 'Awaiting User', 'Resubmitted']);
const KYC_FAILED = new Set(['Declined', 'Abandoned', 'Expired', 'Kyc Expired']);

const STEP_LABELS: Record<StepKey, string> = {
    identity: 'Định danh',
    bank: 'Ngân hàng',
    submit: 'Nộp hồ sơ',
    review: 'Duyệt',
    shop: 'Thiết lập shop',
    listing: 'Đăng bài',
};

const BLOCK_AXIS_LABEL: Record<ProgressBlock['matched_axis'], string> = {
    document: 'trùng CCCD',
    bank: 'trùng số tài khoản',
    both: 'trùng CCCD và số tài khoản',
};

function formatTime(iso: string | null): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));
}

function buildSteps(states: Partial<Record<StepKey, StepState>>, details: Partial<Record<StepKey, string>> = {}): SellerProgressStep[] {
    return (Object.keys(STEP_LABELS) as StepKey[]).map((key) => ({
        key,
        label: STEP_LABELS[key],
        state: states[key] ?? 'upcoming',
        detail: details[key],
    }));
}

export function computeSellerProgress(input: {
    verification: ProgressVerification | null;
    kycSession: ProgressKycSession | null;
    block: ProgressBlock | null;
    profile: ProgressProfile | null;
    listings: ProgressListings | null;
}): SellerProgress {
    const { verification, kycSession, block, profile, listings } = input;

    // --- Has a seller_verifications row: identity + bank happened before submit ---
    if (verification) {
        const bankVerified = Boolean(verification.bank_verified_at && verification.bank_account_name_verified);
        const bankDetail = bankVerified
            ? `Chủ TK: ${verification.bank_account_name_verified}`
            : 'Chưa xác thực tên chủ tài khoản';
        const submitDetail = `Nộp lúc ${formatTime(verification.created_at)}`;

        if (verification.status === 'rejected') {
            const detail = verification.rejection_reason ? `Từ chối: ${verification.rejection_reason}` : 'Hồ sơ bị từ chối';
            return {
                stage: 'rejected',
                stageLabel: 'Bị từ chối',
                detail,
                steps: buildSteps(
                    { identity: 'done', bank: bankVerified ? 'done' : 'failed', submit: 'done', review: 'failed' },
                    { bank: bankDetail, submit: submitDetail, review: detail },
                ),
            };
        }

        if (verification.status === 'pending') {
            return {
                stage: 'pending',
                stageLabel: 'Chờ admin duyệt',
                detail: submitDetail,
                steps: buildSteps(
                    { identity: 'done', bank: bankVerified ? 'done' : 'failed', submit: 'done', review: 'current' },
                    { bank: bankDetail, submit: submitDetail, review: 'Đang chờ duyệt tay' },
                ),
            };
        }

        // approved
        const reviewDetail = verification.auto_approved
            ? 'Tự động duyệt'
            : `Duyệt tay${verification.reviewed_at ? ` lúc ${formatTime(verification.reviewed_at)}` : ''}`;
        const base = { identity: 'done', bank: bankVerified ? 'done' : 'failed', submit: 'done', review: 'done' } as const;
        const baseDetails = { bank: bankDetail, submit: submitDetail, review: reviewDetail };

        const shop = shopReadiness(profile);
        if (!shop.address || !shop.shipping) {
            const missing = [
                !shop.address && 'chưa có địa chỉ lấy hàng',
                !shop.shipping && (shop.carriers.length === 0
                    ? 'chưa chọn đơn vị vận chuyển'
                    : `mới chọn ${shop.carriers.length}/${shop.required} đơn vị vận chuyển`),
            ].filter(Boolean).join(', ');
            const shopDetail = missing.charAt(0).toUpperCase() + missing.slice(1);
            return {
                stage: 'approved',
                stageLabel: 'Đã duyệt · chưa thiết lập xong shop',
                detail: shopDetail,
                steps: buildSteps({ ...base, shop: 'current' }, { ...baseDetails, shop: shopDetail }),
            };
        }

        const shopDetail = `Địa chỉ + ${shop.carriers.length} ĐVVC (${shop.carriers.map((code) => code.toUpperCase()).join(', ')})`;
        const total = listings?.total ?? 0;
        const active = listings?.active ?? 0;
        if (total > 0) {
            const listingDetail = `${total} bài đăng · ${active} đang bán`;
            return {
                stage: 'listed',
                stageLabel: 'Đã đăng bài',
                detail: listingDetail,
                steps: buildSteps({ ...base, shop: 'done', listing: 'done' }, { ...baseDetails, shop: shopDetail, listing: listingDetail }),
            };
        }
        return {
            stage: 'ready',
            stageLabel: 'Sẵn sàng bán · chưa đăng bài nào',
            detail: shopDetail,
            steps: buildSteps({ ...base, shop: 'done', listing: 'current' }, { ...baseDetails, shop: shopDetail, listing: 'Chưa có bài đăng' }),
        };
    }

    // --- No seller_verifications row: user is somewhere before submit ---
    if (block) {
        const detail = `Bị chặn: ${BLOCK_AXIS_LABEL[block.matched_axis]} (${formatTime(block.created_at)})`;
        return {
            stage: 'blocked',
            stageLabel: 'Bị chặn do trùng danh tính',
            detail,
            steps: buildSteps(
                { identity: 'done', bank: 'done', submit: 'failed' },
                { submit: detail },
            ),
        };
    }

    if (!kycSession) {
        return {
            stage: 'not_started',
            stageLabel: 'Chưa bắt đầu',
            steps: buildSteps({ identity: 'current' }),
        };
    }

    const kycDetail = `Didit: ${kycSession.status}`;
    if (kycSession.status === 'Approved') {
        return {
            stage: 'identity_approved',
            stageLabel: 'Định danh xong · chưa nộp hồ sơ',
            detail: 'Đang ở bước ngân hàng / nộp hồ sơ trên web',
            steps: buildSteps(
                { identity: 'done', bank: 'current' },
                { identity: kycDetail, bank: 'Chưa tra cứu ngân hàng' },
            ),
        };
    }
    if (kycSession.status === 'In Review') {
        return {
            stage: 'identity_review',
            stageLabel: 'Didit đang xem xét thủ công',
            detail: kycDetail,
            steps: buildSteps({ identity: 'current' }, { identity: kycDetail }),
        };
    }
    if (KYC_FAILED.has(kycSession.status)) {
        return {
            stage: 'identity_failed',
            stageLabel: 'Định danh thất bại',
            detail: kycDetail,
            steps: buildSteps({ identity: 'failed' }, { identity: kycDetail }),
        };
    }
    // In-flight (or an unknown status we treat as in-flight)
    return {
        stage: 'identity_in_progress',
        stageLabel: KYC_IN_FLIGHT.has(kycSession.status) ? 'Đang định danh' : 'Đang định danh (trạng thái lạ)',
        detail: kycDetail,
        steps: buildSteps({ identity: 'current' }, { identity: kycDetail }),
    };
}
