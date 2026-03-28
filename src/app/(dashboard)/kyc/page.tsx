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
    status: string;
    rejection_reason?: string;
    created_at: string;
    user?: { email: string; display_name: string; profile_image_url: string | null };
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
                        <div key={v.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                            <div className="flex flex-col lg:flex-row gap-6">
                                {/* User Info */}
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        {v.user?.profile_image_url && (
                                            <img src={v.user.profile_image_url} alt="" className="w-10 h-10 rounded-full" />
                                        )}
                                        <div>
                                            <p className="font-semibold text-zinc-900 dark:text-white">
                                                {v.full_name}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {v.user?.display_name || v.user?.email || v.user_id}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-zinc-500 text-xs">Ngân hàng</p>
                                            <p className="font-medium text-zinc-800 dark:text-zinc-200">{v.bank_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-zinc-500 text-xs">Số tài khoản</p>
                                            <p className="font-medium text-zinc-800 dark:text-zinc-200">{v.bank_account_number}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-zinc-500 text-xs">Tên chủ TK</p>
                                            <p className="font-medium text-zinc-800 dark:text-zinc-200">{v.bank_account_name}</p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-zinc-400">
                                        Gửi lúc: {new Date(v.created_at).toLocaleString('vi-VN')}
                                    </p>

                                    {v.status === 'rejected' && v.rejection_reason && (
                                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                                            Lý do từ chối: {v.rejection_reason}
                                        </div>
                                    )}
                                </div>

                                {/* ID Images */}
                                <div className="flex gap-2">
                                    {[
                                        { url: v.id_card_front_url, label: 'CCCD Trước' },
                                        { url: v.id_card_back_url, label: 'CCCD Sau' },
                                        { url: v.selfie_url, label: 'Selfie' },
                                    ].map(img => (
                                        <div key={img.label} className="text-center">
                                            <button
                                                onClick={() => setSelectedImage(img.url)}
                                                className="relative w-24 h-32 rounded-lg overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 hover:border-orange-500 transition-colors"
                                            >
                                                <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center transition-colors">
                                                    <Eye className="h-5 w-5 text-white opacity-0 hover:opacity-100" />
                                                </div>
                                            </button>
                                            <p className="text-xs text-zinc-500 mt-1">{img.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            {activeStatus === 'pending' && (
                                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                                    <button
                                        onClick={() => handleAction(v.id, 'approve')}
                                        disabled={actionLoading === v.id}
                                        className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {actionLoading === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                        Duyệt
                                    </button>

                                    {rejectingId === v.id ? (
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                type="text"
                                                value={rejectionReason}
                                                onChange={e => setRejectionReason(e.target.value)}
                                                placeholder="Nhập lý do từ chối..."
                                                className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                                            />
                                            <button
                                                onClick={() => handleAction(v.id, 'reject')}
                                                disabled={!rejectionReason || actionLoading === v.id}
                                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                                            >
                                                Xác nhận từ chối
                                            </button>
                                            <button
                                                onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                                                className="px-3 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-sm"
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleAction(v.id, 'reject')}
                                            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center gap-2"
                                        >
                                            <XCircle className="h-4 w-4" /> Từ chối
                                        </button>
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
