"use client";

import { useState, useEffect } from "react";
import {
    Bank,
    CircleNotch,
    CheckCircle,
    XCircle,
    Clock,
    Spinner,
    WarningCircle,
} from "@phosphor-icons/react";

type Withdrawal = {
    id: string;
    user_id: string;
    amount_requested: number;
    fee: number;
    amount_net: number;
    bank_name: string;
    bank_account_number: string;
    bank_account_name: string;
    status: string;
    rejection_reason?: string;
    created_at: string;
    processed_at?: string;
    user?: { email: string; display_name: string } | null;
};

const STATUS_TABS = [
    { value: 'pending', label: 'Chờ xử lý', icon: <Clock className="h-4 w-4" /> },
    { value: 'processing', label: 'Đang xử lý', icon: <Spinner className="h-4 w-4" /> },
    { value: 'completed', label: 'Đã chuyển', icon: <CheckCircle className="h-4 w-4" /> },
    { value: 'rejected', label: 'Từ chối', icon: <XCircle className="h-4 w-4" /> },
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    processing: { label: 'Processing', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const formatVND = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function WithdrawalsPage() {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeStatus, setActiveStatus] = useState('pending');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchWithdrawals = async (status: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/withdrawals?status=${status}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load withdrawals');
            setWithdrawals(data.withdrawals || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWithdrawals(activeStatus);
    }, [activeStatus]);

    const handleComplete = async (id: string) => {
        if (!confirm('Xác nhận bạn ĐÃ chuyển khoản cho seller? Hành động này không hoàn tác được.')) return;
        setActionLoading(id);
        try {
            const res = await fetch(`/api/withdrawals/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'complete' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error === 'already_processed' ? 'Yêu cầu này đã được xử lý trước đó.' : (data.error || 'Action failed'));
            fetchWithdrawals(activeStatus);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!rejectingId || !rejectionReason.trim()) return;
        setActionLoading(rejectingId);
        try {
            const res = await fetch(`/api/withdrawals/${rejectingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', rejection_reason: rejectionReason.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error === 'already_processed' ? 'Yêu cầu này đã được xử lý trước đó.' : (data.error || 'Action failed'));
            setRejectingId(null);
            setRejectionReason('');
            fetchWithdrawals(activeStatus);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <WarningCircle className="w-16 h-16 text-yellow-500/50" />
                <h2 className="text-xl font-medium text-zinc-900 dark:text-white">Access Denied / Error</h2>
                <p className="text-zinc-500">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Bank className="h-7 w-7 text-orange-500" />
                        Withdrawals
                    </h1>
                    <p className="text-sm text-zinc-500">
                        Duyệt yêu cầu rút tiền của seller — chuyển khoản tay rồi đánh dấu hoàn tất, hoặc từ chối (tự động hoàn tiền vào ví).
                    </p>
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

            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-xl transition-colors duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                        <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-medium whitespace-nowrap">
                            <tr>
                                <th className="px-6 py-4">Seller</th>
                                <th className="px-6 py-4">Tài khoản nhận (KYC)</th>
                                <th className="px-6 py-4 text-right">Số tiền rút</th>
                                <th className="px-6 py-4 text-right">Phí</th>
                                <th className="px-6 py-4 text-right">Thực chuyển</th>
                                <th className="px-6 py-4">Ngày tạo</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <CircleNotch className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : withdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">
                                        Không có yêu cầu rút tiền nào ở trạng thái này.
                                    </td>
                                </tr>
                            ) : (
                                withdrawals.map((w) => {
                                    const badge = STATUS_BADGES[w.status] || STATUS_BADGES.pending;
                                    const actionable = w.status === 'pending' || w.status === 'processing';
                                    return (
                                        <tr key={w.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-900 dark:text-zinc-200 font-medium">{w.user?.display_name || '—'}</span>
                                                    <span className="text-zinc-400 dark:text-zinc-500 text-xs">{w.user?.email || w.user_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-900 dark:text-zinc-200 font-medium">{w.bank_name}</span>
                                                    <span className="font-mono text-xs">{w.bank_account_number}</span>
                                                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{w.bank_account_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-white whitespace-nowrap">{formatVND(w.amount_requested)}</td>
                                            <td className="px-6 py-4 text-right text-zinc-500 whitespace-nowrap">{formatVND(w.fee)}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-emerald-500 whitespace-nowrap">{formatVND(w.amount_net)}</td>
                                            <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                {new Date(w.created_at).toLocaleDateString('vi-VN')} {new Date(w.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
                                                    {badge.label}
                                                </span>
                                                {w.status === 'rejected' && w.rejection_reason && (
                                                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-[200px]">{w.rejection_reason}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                {actionable && (
                                                    <div className="inline-flex gap-2">
                                                        <button
                                                            onClick={() => handleComplete(w.id)}
                                                            disabled={actionLoading === w.id}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {actionLoading === w.id ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" weight="fill" />}
                                                            Đã chuyển
                                                        </button>
                                                        <button
                                                            onClick={() => { setRejectingId(w.id); setRejectionReason(''); }}
                                                            disabled={actionLoading === w.id}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" weight="fill" />
                                                            Từ chối
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reject reason modal */}
            {rejectingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setRejectingId(null)}>
                    <div
                        className="w-full max-w-md mx-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-500" weight="fill" />
                            Từ chối yêu cầu rút tiền
                        </h3>
                        <p className="text-sm text-zinc-500">
                            Tiền sẽ được hoàn lại đầy đủ vào ví của seller. Vui lòng nhập lý do từ chối (seller sẽ nhận được thông báo này).
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Ví dụ: Thông tin tài khoản ngân hàng không hợp lệ..."
                            rows={3}
                            autoFocus
                            className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setRejectingId(null)}
                                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectionReason.trim() || actionLoading === rejectingId}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {actionLoading === rejectingId && <CircleNotch className="w-4 h-4 animate-spin" />}
                                Xác nhận từ chối & hoàn tiền
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
