'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bank, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useLocalization } from '@/context/LocalizationContext';
import type { AdminTranslationKey } from '@/utils/i18n';

type Withdrawal = {
  id: string;
  user_id: string;
  amount_requested: number;
  fee: number;
  amount_net: number;
  currency: string;
  status: string;
  funding_state: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_masked: string;
  created_at: string;
  recovery_required: boolean;
  recovery_reason?: string | null;
  user?: { display_name?: string | null; email?: string | null } | null;
};

const TABS = [
  ['pending', 'withdrawal_pending'],
  ['processing', 'withdrawal_processing'],
  ['recovery', 'withdrawal_recovery'],
  ['legacy', 'withdrawal_legacy'],
  ['completed', 'withdrawal_completed'],
  ['rejected', 'withdrawal_rejected'],
] as const;

export default function WithdrawalsPage() {
  const { locale, t } = useLocalization();
  const [activeTab, setActiveTab] = useState('pending');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/withdrawals?status=${activeTab}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || t('withdrawal_load_error'));
        if (!cancelled) setWithdrawals(payload.withdrawals || []);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : t('withdrawal_load_error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, t]);

  const formatVND = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND' }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white">
            <Bank className="h-7 w-7 text-orange-500" /> {t('withdrawals_title')}
          </h1>
          <p className="text-sm text-zinc-500">{t('withdrawals_subtitle')}</p>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === value ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
          >
            {t(label as AdminTranslationKey)}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          <WarningCircle className="h-5 w-5" /> {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-zinc-900/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950/50">
              <tr>
                <th className="px-5 py-4">{t('seller')}</th>
                <th className="px-5 py-4">{t('destination_masked')}</th>
                <th className="px-5 py-4 text-right">{t('requested')}</th>
                <th className="px-5 py-4">{t('funding')}</th>
                <th className="px-5 py-4">{t('status')}</th>
                <th className="px-5 py-4 text-right">{t('statement')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><CircleNotch className="mx-auto h-7 w-7 animate-spin text-orange-500" /></td></tr>
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-zinc-500">{t('no_data')}</td></tr>
              ) : withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                  <td className="px-5 py-4">
                    <div className="font-medium text-zinc-900 dark:text-white">{withdrawal.user?.display_name || '-'}</div>
                    <div className="text-xs text-zinc-500">{withdrawal.user?.email || withdrawal.user_id}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div>{withdrawal.bank_name}</div>
                    <div className="font-mono text-xs">{withdrawal.bank_account_masked}</div>
                    <div className="text-xs text-zinc-500">{withdrawal.bank_account_name}</div>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">{formatVND(withdrawal.amount_requested)}</td>
                  <td className="px-5 py-4 text-xs">{withdrawal.funding_state}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full border border-zinc-500/20 px-2 py-1 text-xs">{withdrawal.status}</span>
                    {withdrawal.recovery_required && <div className="mt-1 text-xs text-red-500">{withdrawal.recovery_reason || 'recovery_required'}</div>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/withdrawals/${withdrawal.id}`} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600">
                      {t('open_statement')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
