"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle, XCircle, Clock, Eye, Loader2, AlertTriangle, Ban, Bot } from "lucide-react";
import Image from "next/image";

type Verification = {
    id: string;
    user_id: string;
    full_name: string;
    id_card_front_url?: string | null;
    id_card_back_url?: string | null;
    selfie_url?: string | null;
    bank_name: string;
    bank_bin?: string | null;
    bank_account_number: string;
    bank_account_name: string;
    /** Holder name returned by NAPAS. Null means the lookup never succeeded. */
    bank_account_name_verified?: string | null;
    bank_verified_at?: string | null;
    bank_screenshot_url?: string;
    phone_number?: string;
    ai_cccd_name?: string;
    ai_bank_name?: string;
    ai_bank_number?: string;
    ai_confidence?: number;
    ai_name_match?: boolean;
    status: string;
    rejection_reason?: string;
    created_at: string;
    is_duplicate?: boolean;
    duplicate_notes?: string;
    auto_approved?: boolean;
    /** Why this submission was held back for a human. Null means it auto-approved. */
    review_flags?: string[] | null;
    kyc_provider?: string | null;
    user?: { email: string; display_name: string; profile_image_url: string | null };
    /** Legacy Groq scan — only on rows created before the provider migration. */
    scan?: { cccd_id_number?: string; cccd_dob?: string };
    kyc_session?: {
        provider: string;
        provider_session_id: string;
        status: string;
        verified_full_name: string | null;
        verified_dob: string | null;
        verified_document_type: string | null;
        liveness_score: number | null;
        face_match_score: number | null;
        nfc_verified: boolean;
        warnings: Array<{ shortDescription?: string | null; risk?: string | null; logType?: string | null }> | null;
    } | null;
};

/** A submission refused outright: it never became a `seller_verifications` row. */
type BlockedAttempt = {
    id: string;
    matched_axis: 'document' | 'bank' | 'both';
    created_at: string;
    bank_account_number: string | null;
    user: { id?: string; email?: string; display_name?: string };
    matched_users: Array<{ id?: string; email?: string; display_name?: string }>;
};

const STATUS_TABS = [
    { value: 'pending', label: 'Chờ duyệt', icon: <Clock className="h-4 w-4" /> },
    { value: 'approved', label: 'Đã duyệt', icon: <CheckCircle className="h-4 w-4" /> },
    { value: 'rejected', label: 'Từ chối', icon: <XCircle className="h-4 w-4" /> },
    { value: 'blocked', label: 'Bị chặn', icon: <Ban className="h-4 w-4" /> },
];

const AXIS_LABEL: Record<BlockedAttempt['matched_axis'], string> = {
    document: 'Trùng giấy tờ tùy thân',
    bank: 'Trùng số tài khoản ngân hàng',
    both: 'Trùng cả giấy tờ lẫn số tài khoản',
};

export default function KYCPage() {
    const [verifications, setVerifications] = useState<Verification[]>([]);
    const [blocked, setBlocked] = useState<BlockedAttempt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('pending');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const fetchVerifications = async (status: string) => {
        setIsLoading(true);
        try {
            if (status === 'blocked') {
                const res = await fetch('/api/kyc/blocked');
                const data = await res.json();
                setBlocked(data.blocks || []);
                setVerifications([]);
                return;
            }
            const res = await fetch(`/api/kyc?status=${status}`);
            const data = await res.json();
            setVerifications(data.verifications || []);
            setBlocked([]);
        } catch (err) {
            console.error('Failed to fetch:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVerifications(activeStatus);
    }, [activeStatus]);

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        if (action === 'reject' && !rejectionReason) {
            setRejectingId(id);
            return;
        }
        setActionLoading(id);
        setActionError(null);
        try {
            const res = await fetch('/api/kyc', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verification_id: id, action, rejection_reason: rejectionReason }),
            });
            const payload = await res.json().catch(() => ({}));
            // A 409 here is the duplicate guard refusing to mint a second seller
            // for the same identity — the admin needs to read that, not a silent
            // no-op followed by an unchanged list.
            if (!res.ok) throw new Error(payload.error || 'Action failed');
            fetchVerifications(activeStatus);
            setRejectingId(null);
            setRejectionReason('');
        } catch (err) {
            console.error('Action error:', err);
            setActionError(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="h-7 w-7 text-orange-500" />
                        KYC Sellers
                    </h1>
                    <p className="text-sm text-zinc-500">Quản lý xác minh người bán</p>
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2">
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setActiveStatus(tab.value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeStatus === tab.value
                                ? 'bg-orange-500 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {actionError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{actionError}</span>
                </div>
            )}

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : activeStatus === 'blocked' ? (
                blocked.length === 0 ? (
                    <div className="text-center py-16 text-zinc-500">
                        Chưa có lượt đăng ký nào bị chặn.
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-zinc-500">
                            Các lượt đăng ký bị từ chối ngay vì giấy tờ hoặc số tài khoản đã thuộc về một tài khoản khác.
                            Chúng không tạo hồ sơ nào. Muốn gỡ chặn: từ chối hồ sơ của tài khoản đang giữ danh tính đó.
                        </p>
                        {blocked.map(b => (
                            <div key={b.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-zinc-900 dark:text-white">
                                            {b.user.display_name || b.user.email || b.user.id}
                                        </p>
                                        {b.user.email && b.user.display_name && (
                                            <p className="text-sm text-zinc-500">{b.user.email}</p>
                                        )}
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                                        <Ban className="h-3.5 w-3.5" /> {AXIS_LABEL[b.matched_axis]}
                                    </span>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs text-zinc-500">Số tài khoản đã dùng</p>
                                        <p className="font-mono text-zinc-900 dark:text-zinc-100">{b.bank_account_number || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500">Thời điểm</p>
                                        <p className="text-zinc-900 dark:text-zinc-100">
                                            {new Date(b.created_at).toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                                {b.matched_users.length > 0 && (
                                    <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
                                        <p className="text-xs text-zinc-500">Trùng với tài khoản</p>
                                        <ul className="mt-1 space-y-0.5 text-sm text-zinc-900 dark:text-zinc-100">
                                            {b.matched_users.map((m, i) => (
                                                <li key={i}>{m.display_name || m.email || m.id}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            ) : verifications.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">
                    Không có yêu cầu nào.
                </div>
            ) : (
                <div className="space-y-4">
                    {verifications.map(v => (
                        <div key={v.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col xl:flex-row gap-8">
                                {/* User Info Column */}
                                <div className="flex-1 space-y-6">
                                    {/* Header: User Profile */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            {v.user?.profile_image_url ? (
                                                <img src={v.user.profile_image_url} alt="" className="w-12 h-12 rounded-full border border-zinc-100 dark:border-zinc-800 object-cover" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 font-medium">
                                                    {v.full_name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                                                    {v.full_name}
                                                    {v.auto_approved && (
                                                        <span
                                                            title="Hệ thống tự duyệt, không qua admin"
                                                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                                        >
                                                            <Bot className="h-3 w-3" /> Tự duyệt
                                                        </span>
                                                    )}
                                                </h3>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                                    {v.user?.email || v.user?.display_name || v.user_id}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Submitted
                                            </p>
                                            <p className="text-sm text-zinc-900 dark:text-zinc-300">
                                                {new Date(v.created_at).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Duplicate (ban-evasion / shared documents) warning */}
                                    {v.is_duplicate && (
                                        <div className="flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4">
                                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ Cảnh báo trùng thông tin</p>
                                                <p className="text-sm text-red-600/90 dark:text-red-300/90 mt-0.5">
                                                    {v.duplicate_notes || 'CCCD hoặc số tài khoản này đã được dùng ở một tài khoản khác. Hãy kiểm tra kỹ khả năng dùng chung giấy tờ / lách ban trước khi duyệt.'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                        {/* Identity Info */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                Identity Details
                                            </h4>
                                            <div className="space-y-2">
                                                {v.phone_number && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-zinc-500">Phone</span>
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.phone_number}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-zinc-500">Full Name</span>
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.full_name}</span>
                                                </div>
                                                {v.kyc_session?.verified_full_name && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-zinc-500">Verified Name</span>
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.kyc_session.verified_full_name}</span>
                                                    </div>
                                                )}
                                                {v.scan?.cccd_id_number && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-zinc-500">ID Number (legacy)</span>
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.scan.cccd_id_number}</span>
                                                    </div>
                                                )}
                                                {(v.kyc_session?.verified_dob || v.scan?.cccd_dob) && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-zinc-500">Date of Birth</span>
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.kyc_session?.verified_dob || v.scan?.cccd_dob}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bank Info */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                Banking Details
                                            </h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-zinc-500">Bank</span>
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                        {v.bank_name}{v.bank_bin ? ` (${v.bank_bin})` : ''}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-zinc-500">Account No.</span>
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.bank_account_number}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-zinc-500">Account Name</span>
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.bank_account_name}</span>
                                                </div>
                                                {/* Whether the holder came from NAPAS or was merely typed in
                                                    decides how much this row can be trusted at payout time. */}
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-zinc-500">NAPAS Lookup</span>
                                                    {v.bank_verified_at ? (
                                                        <span className="text-sm font-semibold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                                                            <CheckCircle className="w-4 h-4" /> Khớp chủ tài khoản
                                                        </span>
                                                    ) : v.bank_account_name_verified ? (
                                                        <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 text-right">
                                                            Lệch — ngân hàng trả về “{v.bank_account_name_verified}”
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                            <XCircle className="w-4 h-4" /> Chưa tra cứu được
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Why a human is looking at this at all. Everything that
                                        auto-approves never reaches this screen. */}
                                    {v.review_flags && v.review_flags.length > 0 && (
                                        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
                                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4" /> Lý do cần soát thủ công
                                            </p>
                                            <ul className="list-disc list-inside space-y-1">
                                                {v.review_flags.map((flag, i) => (
                                                    <li key={i} className="text-sm text-amber-700 dark:text-amber-300">{flag}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Identity attested by the verification provider */}
                                    {v.kyc_session && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                                                    Provider Verification
                                                </h4>
                                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                                                    {v.kyc_session.provider} • {v.kyc_session.status}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Liveness</p>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                        {v.kyc_session.liveness_score ?? '—'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Face Match</p>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                        {v.kyc_session.face_match_score ?? '—'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">NFC Chip</p>
                                                    <p className={`text-sm font-semibold flex items-center gap-1.5 ${v.kyc_session.nfc_verified ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
                                                        {v.kyc_session.nfc_verified ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                        {v.kyc_session.nfc_verified ? 'Đã đọc chip' : 'Không đọc chip'}
                                                    </p>
                                                </div>

                                                {v.kyc_session.warnings && v.kyc_session.warnings.length > 0 && (
                                                    <div className="col-span-1 sm:col-span-3 pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
                                                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Provider warnings</p>
                                                        {v.kyc_session.warnings.map((w, i) => (
                                                            <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
                                                                • {w.shortDescription || w.risk}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="col-span-1 sm:col-span-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                                    <p className="text-xs text-zinc-500">
                                                        Session <span className="font-mono">{v.kyc_session.provider_session_id}</span> — mở trên dashboard nhà cung cấp để xem ảnh giấy tờ.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Legacy Groq analysis — pre-migration rows only */}
                                    {!v.kyc_session && v.ai_confidence !== undefined && v.ai_confidence !== null && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                                                    AI Analysis
                                                </h4>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                    v.ai_confidence >= 0.7
                                                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                                                        : v.ai_confidence >= 0.5
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                                                }`}>
                                                    {Math.round(v.ai_confidence * 100)}% Match Confidence
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">ID Card Extraction</p>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.ai_cccd_name || '—'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Bank App Extraction</p>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.ai_bank_name || '—'} • {v.ai_bank_number || '—'}</p>
                                                </div>
                                                <div className="col-span-1 sm:col-span-2 pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Name Matching Status</span>
                                                        <span className={`text-sm font-semibold flex items-center gap-1.5 ${v.ai_name_match ? 'text-zinc-900 dark:text-zinc-100' : 'text-rose-600 dark:text-rose-400'}`}>
                                                            {v.ai_name_match ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                            {v.ai_name_match ? 'Verified Match' : 'Mismatch Detected'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {v.status === 'rejected' && v.rejection_reason && (
                                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-rose-800 dark:text-rose-400 uppercase tracking-wider mb-1">Rejection Reason</p>
                                            <p className="text-sm text-rose-700 dark:text-rose-300">{v.rejection_reason}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Media Column */}
                                <div className="xl:w-80 space-y-4">
                                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                        Documents
                                    </h4>
                                    {/* New submissions carry no ID images: the provider holds
                                        them. Only the optional bank screenshot lands here. */}
                                    {!v.id_card_front_url && !v.bank_screenshot_url && (
                                        <p className="text-sm text-zinc-500">
                                            Ảnh giấy tờ do {v.kyc_provider || 'nhà cung cấp'} lưu giữ. Xem trong dashboard của họ.
                                        </p>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            ...(v.id_card_front_url ? [{ url: v.id_card_front_url, label: 'CCCD Trước' }] : []),
                                            ...(v.id_card_back_url ? [{ url: v.id_card_back_url, label: 'CCCD Sau' }] : []),
                                            ...(v.selfie_url ? [{ url: v.selfie_url, label: 'Selfie' }] : []),
                                            ...(v.bank_screenshot_url ? [{ url: v.bank_screenshot_url, label: 'App Ngân hàng' }] : []),
                                        ].map((img, idx) => (
                                            <div key={idx} className="group relative">
                                                <button
                                                    onClick={() => setSelectedImage(img.url)}
                                                    className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
                                                >
                                                    <img src={img.url} alt={img.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    <div className="absolute inset-0 bg-zinc-900/0 group-hover:bg-zinc-900/20 transition-colors flex items-center justify-center">
                                                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                                    </div>
                                                </button>
                                                <p className="text-xs font-medium text-zinc-500 mt-2 text-center">{img.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            {activeStatus === 'pending' && (
                                <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                                    {rejectingId === v.id ? (
                                        <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
                                            <input
                                                type="text"
                                                value={rejectionReason}
                                                onChange={e => setRejectionReason(e.target.value)}
                                                placeholder="Provide a reason for rejection..."
                                                className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-shadow"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                                                className="px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleAction(v.id, 'reject')}
                                                disabled={!rejectionReason || actionLoading === v.id}
                                                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                                            >
                                                {actionLoading === v.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                                Confirm Rejection
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleAction(v.id, 'reject')}
                                                className="px-5 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-sm font-medium transition-colors"
                                            >
                                                Từ chối
                                            </button>
                                            <button
                                                onClick={() => handleAction(v.id, 'approve')}
                                                disabled={actionLoading === v.id}
                                                className="px-6 py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                                            >
                                                {actionLoading === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                Duyệt hồ sơ
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Image Preview Modal */}
            {selectedImage && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} alt="Preview" className="max-w-[90vw] max-h-[90vh] rounded-lg" />
                </div>
            )}
        </div>
    );
}
