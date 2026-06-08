"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle, XCircle, Clock, Eye, Loader2 } from "lucide-react";
import Image from "next/image";

type Verification = {
    id: string;
    user_id: string;
    full_name: string;
    id_card_front_url: string;
    id_card_back_url: string;
    selfie_url: string;
    bank_name: string;
    bank_account_number: string;
    bank_account_name: string;
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
    user?: { email: string; display_name: string; profile_image_url: string | null };
    scan?: { cccd_id_number?: string; cccd_dob?: string };
};

const STATUS_TABS = [
    { value: 'pending', label: 'Chờ duyệt', icon: <Clock className="h-4 w-4" /> },
    { value: 'approved', label: 'Đã duyệt', icon: <CheckCircle className="h-4 w-4" /> },
    { value: 'rejected', label: 'Từ chối', icon: <XCircle className="h-4 w-4" /> },
];

export default function KYCPage() {
    const [verifications, setVerifications] = useState<Verification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('pending');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const fetchVerifications = async (status: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/kyc?status=${status}`);
            const data = await res.json();
            setVerifications(data.verifications || []);
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
        try {
            const res = await fetch('/api/kyc', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verification_id: id, action, rejection_reason: rejectionReason }),
            });
            if (!res.ok) throw new Error('Action failed');
            fetchVerifications(activeStatus);
            setRejectingId(null);
            setRejectionReason('');
        } catch (err) {
            console.error('Action error:', err);
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

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
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
                                                <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">
                                                    {v.full_name}
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
                                                {v.scan?.cccd_id_number && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-zinc-500">ID Number</span>
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.scan.cccd_id_number}</span>
                                                    </div>
                                                )}
                                                {v.scan?.cccd_dob && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-zinc-500">Date of Birth</span>
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.scan.cccd_dob}</span>
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
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.bank_name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-zinc-500">Account No.</span>
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.bank_account_number}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-zinc-500">Account Name</span>
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{v.bank_account_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Verification Results */}
                                    {v.ai_confidence !== undefined && v.ai_confidence !== null && (
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
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { url: v.id_card_front_url, label: 'CCCD Trước' },
                                            { url: v.id_card_back_url, label: 'CCCD Sau' },
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
