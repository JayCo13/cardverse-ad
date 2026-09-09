'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CircleNotch, Medal, WarningCircle } from '@phosphor-icons/react';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useLocalization } from '@/context/LocalizationContext';

type Standing = {
    id: string;
    display_name: string | null;
    email: string | null;
    reputation_score: number;
    reputation_incidents_90d: number;
    reputation_incidents_total: number;
    completed_transactions: number;
};

type LedgerRow = {
    id: string;
    role: 'buyer' | 'seller';
    event_type: string;
    delta: number;
    note: string | null;
    created_by: string | null;
    created_by_role: string | null;
    voided_at: string | null;
    created_at: string;
};

const TABS = [
    ['flagged', 'reputation_tab_flagged'],
    ['negative', 'reputation_tab_negative'],
    ['all', 'reputation_tab_all'],
] as const;

/** Reads as prose in the ledger without needing a translation key per event. */
const EVENT_LABEL: Record<string, string> = {
    order_completed: 'Đơn hoàn tất',
    offer_unpaid: 'Offer được accept nhưng không thanh toán',
    buyer_cancelled: 'Buyer chủ động bỏ mua',
    seller_cancelled: 'Seller huỷ đơn đã thanh toán / quá hạn gửi',
    seller_wrong_item: 'Seller giao sai hàng hoặc sai mô tả',
    buyer_fraud: 'Buyer gian lận',
    seller_counterfeit: 'Seller bán hàng giả hoặc gian lận',
    no_fault: 'Không bên nào có lỗi',
    admin_adjust: 'Điều chỉnh tay',
};

export default function ReputationPage() {
    const { t } = useLocalization();
    const [tab, setTab] = useState<string>('flagged');
    const [rows, setRows] = useState<Standing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selected, setSelected] = useState<Standing | null>(null);
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    const [voiding, setVoiding] = useState<LedgerRow | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/reputation?filter=${tab}`, { cache: 'no-store' });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || t('reputation_failed'));
            setRows(payload.profiles || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('reputation_failed'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [tab, t]);

    useEffect(() => { void loadList(); }, [loadList]);

    const openLedger = async (row: Standing) => {
        setSelected(row);
        setLedgerLoading(true);
        try {
            const res = await fetch(`/api/reputation?userId=${row.id}`, { cache: 'no-store' });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || t('reputation_failed'));
            setLedger(payload.events || []);
            if (payload.profile) setSelected(payload.profile);
        } catch {
            setLedger([]);
        } finally {
            setLedgerLoading(false);
        }
    };

    const submitVoid = async () => {
        if (!voiding || reason.trim().length < 10) return;
        setBusy(true);
        try {
            const res = await fetch('/api/reputation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'void', event_id: voiding.id, reason: reason.trim() }),
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || t('reputation_failed'));
            setVoiding(null);
            setReason('');
            if (selected) await openLedger(selected);
            await loadList();
        } catch (e) {
            setError(e instanceof Error ? e.message : t('reputation_failed'));
        } finally {
            setBusy(false);
        }
    };

    const scoreTone = (score: number) => score < 0
        ? 'text-rose-500'
        : score === 0 ? 'text-zinc-400' : 'text-emerald-500';

    if (selected) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <button
                            onClick={() => { setSelected(null); setLedger([]); }}
                            className="mb-2 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-orange-500"
                        >
                            <ArrowLeft className="h-4 w-4" />{t('reputation_title')}
                        </button>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {selected.display_name || selected.email || selected.id}
                        </h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            <span className={scoreTone(selected.reputation_score)}>
                                {t('reputation_col_score')} {selected.reputation_score}
                            </span>
                            {' · '}{selected.completed_transactions} {t('reputation_col_orders')}
                            {' · '}{selected.reputation_incidents_90d} {t('reputation_col_incidents_90d')}
                            {' · '}{selected.reputation_incidents_total} {t('reputation_col_incidents_total')}
                        </p>
                    </div>
                    <LanguageSwitcher />
                </div>

                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-zinc-900/50">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950/50">
                            <tr>
                                <th className="px-4 py-3">{t('reputation_col_event')}</th>
                                <th className="px-4 py-3">{t('reputation_col_delta')}</th>
                                <th className="px-4 py-3">{t('reputation_col_by')}</th>
                                <th className="px-4 py-3">{t('reputation_col_when')}</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                            {ledgerLoading && (
                                <tr><td colSpan={5} className="px-4 py-10 text-center">
                                    <CircleNotch className="mx-auto h-6 w-6 animate-spin text-orange-500" />
                                </td></tr>
                            )}
                            {!ledgerLoading && ledger.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                                    {t('reputation_no_events')}
                                </td></tr>
                            )}
                            {ledger.map(row => (
                                <tr key={row.id} className={`hover:bg-zinc-50 dark:hover:bg-white/[0.02] ${row.voided_at ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-zinc-900 dark:text-white">
                                            {EVENT_LABEL[row.event_type] || row.event_type}
                                        </p>
                                        <p className="text-xs text-zinc-500">{row.role}{row.note ? ` · ${row.note}` : ''}</p>
                                    </td>
                                    <td className={`px-4 py-3 font-mono tabular-nums ${row.delta < 0 ? 'text-rose-500' : row.delta > 0 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-zinc-500">
                                        {row.created_by ? `${row.created_by_role || ''} ${row.created_by}`.trim() : t('reputation_system')}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-zinc-500">
                                        {new Date(row.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {row.voided_at ? (
                                            <span className="text-xs text-zinc-400">{t('reputation_voided')}</span>
                                        ) : row.delta < 0 ? (
                                            <button
                                                onClick={() => { setVoiding(row); setReason(''); }}
                                                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-500 dark:border-white/10 dark:text-zinc-400"
                                            >
                                                {t('reputation_void')}
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {voiding && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t('reputation_void_title')}</h2>
                            <p className="mt-1.5 text-sm text-zinc-500">{t('reputation_void_desc')}</p>
                            <label className="mt-4 block text-xs font-medium text-zinc-500">{t('reputation_reason')}</label>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                rows={3}
                                placeholder={t('reputation_reason_placeholder')}
                                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent p-2.5 text-sm outline-none focus:border-orange-500 dark:border-white/10"
                            />
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setVoiding(null)}
                                    disabled={busy}
                                    className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                                >
                                    {t('reputation_cancel')}
                                </button>
                                <button
                                    onClick={() => void submitVoid()}
                                    disabled={busy || reason.trim().length < 10}
                                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
                                >
                                    {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : t('reputation_confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
                        <Medal className="h-7 w-7 text-orange-500" />{t('reputation_title')}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">{t('reputation_subtitle')}</p>
                </div>
                <LanguageSwitcher />
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map(([id, key]) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${tab === id
                            ? 'bg-orange-500 text-white'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                    >
                        {t(key)}
                    </button>
                ))}
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-500">
                    <WarningCircle className="h-5 w-5 shrink-0" />{error}
                </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-zinc-900/50">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950/50">
                        <tr>
                            <th className="px-4 py-3">{t('reputation_col_user')}</th>
                            <th className="px-4 py-3">{t('reputation_col_score')}</th>
                            <th className="px-4 py-3">{t('reputation_col_orders')}</th>
                            <th className="px-4 py-3">{t('reputation_col_incidents_90d')}</th>
                            <th className="px-4 py-3">{t('reputation_col_incidents_total')}</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                        {loading && (
                            <tr><td colSpan={6} className="px-4 py-10 text-center">
                                <CircleNotch className="mx-auto h-6 w-6 animate-spin text-orange-500" />
                            </td></tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                                {t('reputation_no_data')}
                            </td></tr>
                        )}
                        {rows.map(row => (
                            <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                                <td className="px-4 py-3">
                                    <p className="font-medium text-zinc-900 dark:text-white">{row.display_name || '—'}</p>
                                    <p className="text-xs text-zinc-500">{row.email}</p>
                                </td>
                                <td className={`px-4 py-3 font-mono tabular-nums font-medium ${scoreTone(row.reputation_score)}`}>
                                    {row.reputation_score}
                                </td>
                                <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">{row.completed_transactions}</td>
                                <td className="px-4 py-3 tabular-nums">
                                    <span className={row.reputation_incidents_90d >= 2 ? 'font-medium text-amber-600' : 'text-zinc-500'}>
                                        {row.reputation_incidents_90d}
                                    </span>
                                </td>
                                <td className="px-4 py-3 tabular-nums text-zinc-500">{row.reputation_incidents_total}</td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => void openLedger(row)}
                                        className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600"
                                    >
                                        {t('reputation_view_ledger')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
