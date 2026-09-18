/**
 * Derives the seller-verification progress shown on /sellers from the raw
 * rows the admin API already reads. Kept pure so the API computes it once
 * and the client only renders it.
 *
 * Step order mirrors the consumer /sell wizard:
 *   identity (Didit eKYC) → bank (NAPAS lookup) → submit → review → ready
 */

export type StepKey = 'identity' | 'bank' | 'submit' | 'review' | 'ready';
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
    | 'ready';

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
};

// Didit vocabulary — keep in sync with cardverse-web/src/lib/kyc/types.ts
const KYC_IN_FLIGHT = new Set(['Not Started', 'In Progress', 'Awaiting User', 'Resubmitted']);
const KYC_FAILED = new Set(['Declined', 'Abandoned', 'Expired', 'Kyc Expired']);

const STEP_LABELS: Record<StepKey, string> = {
    identity: 'Định danh',
    bank: 'Ngân hàng',
    submit: 'Nộp hồ sơ',
    review: 'Duyệt',
    ready: 'Sẵn sàng bán',
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
}): SellerProgress {
    const { verification, kycSession, block, profile } = input;

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
        const hasAddress = Boolean(profile?.address_province_id && profile?.address_ward_code);
        if (hasAddress) {
            return {
                stage: 'ready',
                stageLabel: 'Sẵn sàng đăng bán',
                detail: reviewDetail,
                steps: buildSteps(
                    { identity: 'done', bank: bankVerified ? 'done' : 'failed', submit: 'done', review: 'done', ready: 'done' },
                    { bank: bankDetail, submit: submitDetail, review: reviewDetail, ready: 'Đã có địa chỉ lấy hàng' },
                ),
            };
        }
        return {
            stage: 'approved',
            stageLabel: 'Đã duyệt · chưa có địa chỉ lấy hàng',
            detail: 'Chưa thể đăng bán cho tới khi cập nhật địa chỉ',
            steps: buildSteps(
                { identity: 'done', bank: bankVerified ? 'done' : 'failed', submit: 'done', review: 'done', ready: 'current' },
                { bank: bankDetail, submit: submitDetail, review: reviewDetail, ready: 'Chưa có địa chỉ lấy hàng' },
            ),
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
