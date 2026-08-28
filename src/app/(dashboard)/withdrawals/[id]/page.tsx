'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useLocalization } from '@/context/LocalizationContext';
import type { AdminTranslationKey } from '@/utils/i18n';

type Statement = {
  actor_role: 'admin' | 'moderator';
  withdrawal: {
    id: string;
    status: string;
    funding_state: string;
    amount_requested: number;
    fee: number;
    amount_net: number;
    currency: string;
    bank_name: string;
    bank_account_name: string;
    bank_account_masked: string;
    processing_expires_at?: string | null;
    transfer_started_at?: string | null;
    recovery_required: boolean;
    recovery_reason?: string | null;
    claimed_by?: string | null;
    risk_flags: unknown[];
  };
  user: { display_name?: string; email?: string };
  kyc: Record<string, unknown>;
  balances: Record<string, number>;
  totals: Record<string, number>;
  reconciliation: Record<string, unknown>;
  blockers: unknown[];
  sources: Array<Record<string, unknown>>;
  allocations: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  transfer_attempts: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
};

type StartTransferResult = {
  attempt_id: string;
  amount_requested: number;
  fee: number;
  amount_net: number;
  currency: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
};

type ModalAction = 'complete' | 'mark_failed' | 'takeover_recovery' | 'reject' | 'record_returned' | 'resolve_legacy';

type ModalForm = {
  reference: string;
  reason: string;
  evidenceReference: string;
  outcome: string;
};

const emptyModalForm: ModalForm = {
  reference: '',
  reason: '',
  evidenceReference: '',
  outcome: '',
};

const fieldTranslationKeys: Record<string, AdminTranslationKey> = {
  stored_available: 'stored_available',
  stored_held: 'stored_held',
  stored_total: 'stored_total',
  verified_available: 'verified_available',
  verified_held: 'verified_held',
  verified_total: 'verified_total',
  unverified_available: 'unverified_available',
  unverified_held: 'unverified_held',
  unverified_total: 'unverified_total',
  deposits: 'deposits',
  sales: 'sales',
  refunds: 'refunds',
  spending: 'spending',
  legacy_reconciled: 'legacy_reconciled',
  withdrawals_held: 'withdrawals_held',
  withdrawals_completed: 'withdrawals_completed',
};

const statusTranslationKeys: Record<string, AdminTranslationKey> = {
  pending: 'status_pending',
  processing: 'status_processing',
  completed: 'status_completed',
  rejected: 'status_rejected',
  verified: 'status_verified',
  unverified: 'status_unverified',
  reserved: 'status_reserved',
  consumed: 'status_consumed',
  released: 'status_released',
  started: 'status_started',
  confirmed: 'status_confirmed',
  failed: 'status_failed',
  returned: 'status_returned',
  approved: 'status_approved',
  native_verified: 'funding_native_verified',
  legacy_verified: 'funding_legacy_verified',
  legacy_blocked: 'funding_legacy_blocked',
  payos_deposit: 'type_payos_deposit',
  marketplace_sale: 'type_marketplace_sale',
  refund: 'type_refund',
  withdrawal_return: 'type_withdrawal_return',
  legacy_reconciliation: 'type_legacy_reconciliation',
  wallet_purchase: 'type_wallet_purchase',
  withdrawal: 'type_withdrawal',
  withdrawal_hold: 'type_withdrawal_hold',
  verify_for_transfer: 'action_verify_for_transfer',
  start_transfer: 'action_start_transfer',
  release_claim: 'action_release_claim',
  complete: 'action_complete',
  reject: 'action_reject',
  mark_transfer_failed: 'action_mark_transfer_failed',
  record_returned: 'action_record_returned',
  resolve_legacy: 'action_resolve_legacy',
  takeover_recovery: 'action_takeover_recovery',
  admin: 'role_admin',
  moderator: 'role_moderator',
  legacy_funding_review_required: 'blocker_legacy_funding',
  transfer_recovery_required: 'blocker_transfer_recovery',
};

function stringValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function numberValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value || 0);
}

export default function WithdrawalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale, t } = useLocalization();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [fullDestination, setFullDestination] = useState<StartTransferResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [modalForm, setModalForm] = useState<ModalForm>(emptyModalForm);
  const [modalError, setModalError] = useState<string | null>(null);
  const actionKeys = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/withdrawals/${id}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t('withdrawal_statement_load_error'));
    setStatement(payload);
  }, [id, t]);

  useEffect(() => {
    load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [load]);

  const action = async (name: string, payload: Record<string, unknown> = {}) => {
    const fingerprint = `${name}:${JSON.stringify(payload)}`;
    actionKeys.current[fingerprint] ||= crypto.randomUUID();
    setActing(true);
    setError(null);
    try {
      const response = await fetch(`/api/withdrawals/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': actionKeys.current[fingerprint],
        },
        body: JSON.stringify({ action: name, payload }),
      });
      const result = await response.json();
      if (!response.ok) {
        const errorMessage = result.error === 'rejection_reason_required'
          ? t('withdrawal_rejection_reason_required')
          : result.error === 'rejection_forbidden'
            ? t('withdrawal_rejection_forbidden')
            : t('withdrawal_action_failed');
        throw new Error(errorMessage);
      }
      delete actionKeys.current[fingerprint];
      if (name === 'start_transfer') setFullDestination(result as StartTransferResult);
      else setFullDestination(null);
      await load();
      return result;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('withdrawal_action_failed'));
      return null;
    } finally {
      setActing(false);
    }
  };

  const openActionModal = (name: ModalAction) => {
    setModalAction(name);
    setModalError(null);
    setModalForm({
      ...emptyModalForm,
      outcome: name === 'mark_failed' ? 'pending' : name === 'resolve_legacy' ? 'unknown' : '',
    });
  };

  const closeActionModal = () => {
    if (acting) return;
    setModalAction(null);
    setModalError(null);
    setModalForm(emptyModalForm);
  };

  const submitActionModal = async () => {
    if (!modalAction) return;
    const reference = modalForm.reference.trim();
    const reason = modalForm.reason.trim();
    const evidenceReference = modalForm.evidenceReference.trim();
    let result: unknown = null;

    if (modalAction === 'complete') {
      if (!reference) return setModalError(t('validation_reference_required'));
      result = await action('complete', { transfer_reference: reference });
    } else if (modalAction === 'reject') {
      if (!reason) return setModalError(t('validation_reason_required'));
      result = await action('reject', { reason });
    } else if (modalAction === 'mark_failed') {
      if (!reason || !evidenceReference) return setModalError(t('validation_reason_evidence_required'));
      result = await action('mark_transfer_failed', {
        reason,
        evidence: { reference: evidenceReference },
        outcome: modalForm.outcome,
      });
    } else if (modalAction === 'takeover_recovery') {
      if (!reason || !evidenceReference) return setModalError(t('validation_reason_evidence_required'));
      result = await action('takeover_recovery', { reason, evidence: { reference: evidenceReference } });
    } else if (modalAction === 'record_returned') {
      if (!reference || !evidenceReference) return setModalError(t('validation_reference_evidence_required'));
      result = await action('record_returned', {
        return_reference: reference,
        evidence: { reference: evidenceReference },
      });
    } else if (modalAction === 'resolve_legacy') {
      if (!reason) return setModalError(t('validation_reason_required'));
      if (modalForm.outcome === 'confirmed_sent' && !reference) return setModalError(t('validation_reference_required'));
      result = await action('resolve_legacy', {
        outcome: modalForm.outcome,
        reason,
        transfer_reference: modalForm.outcome === 'confirmed_sent' ? reference : null,
        evidence: { summary: reason },
      });
    }

    if (result) closeActionModal();
  };

  const money = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND' }).format(amount);

  const dateTime = (value: unknown) => {
    if (typeof value !== 'string' || !value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const fieldLabel = (key: string) => {
    const translationKey = fieldTranslationKeys[key];
    return translationKey ? t(translationKey) : key.replaceAll('_', ' ');
  };

  const statusLabel = (value: unknown) => {
    const status = typeof value === 'string' ? value : '';
    const translationKey = statusTranslationKeys[status];
    return translationKey ? t(translationKey) : status.replaceAll('_', ' ') || '—';
  };

  const statusBadge = (value: unknown) => {
    const status = typeof value === 'string' ? value : '';
    const positive = ['approved', 'verified', 'completed', 'confirmed', 'native_verified', 'legacy_verified'].includes(status);
    const negative = ['rejected', 'failed', 'unverified', 'legacy_blocked'].includes(status);
    const warning = ['pending', 'processing', 'reserved', 'started'].includes(status);
    const className = positive
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
      : negative
        ? 'border-red-500/30 bg-red-500/10 text-red-500'
        : warning
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
          : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-500';
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{statusLabel(status)}</span>;
  };

  if (loading) return <div className="p-8 text-zinc-500">{t('loading_statement')}</div>;
  if (!statement) return <div className="p-8 text-red-500">{error || t('withdrawal_not_found')}</div>;
  const withdrawal = statement.withdrawal;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('withdrawal_statement')}</h1>
          <p className="font-mono text-xs text-zinc-500">{withdrawal.id}</p>
        </div>
        <LanguageSwitcher />
      </div>
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(statement.balances).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs uppercase text-zinc-500">{fieldLabel(label)}</div>
            <div className="mt-1 text-xl font-semibold">{money(value)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-semibold">{t('kyc_snapshot')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-zinc-500">{t('kyc_status')}</dt><dd>{statusBadge(statement.kyc.status)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('full_name')}</dt><dd className="text-right">{stringValue(statement.kyc, 'full_name') || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('bank')}</dt><dd className="text-right">{stringValue(statement.kyc, 'bank_name') || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('account')}</dt><dd className="font-mono text-right">{stringValue(statement.kyc, 'bank_account_masked') || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('verified_holder')}</dt><dd className="text-right">{stringValue(statement.kyc, 'bank_account_name_verified') || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('bank_verified_at')}</dt><dd className="text-right">{dateTime(statement.kyc.bank_verified_at)}</dd></div>
          </dl>
        </section>
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-semibold">{t('reconciliation_state')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-zinc-500">{t('funding')}</dt><dd>{statusBadge(statement.reconciliation.funding_state)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('legacy_source_count')}</dt><dd>{numberValue(statement.reconciliation, 'legacy_source_count')}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('unverified_available')}</dt><dd>{money(numberValue(statement.reconciliation, 'unverified_available'))}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('unverified_held')}</dt><dd>{money(numberValue(statement.reconciliation, 'unverified_held'))}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">{t('unresolved_unverified_total')}</dt><dd>{money(numberValue(statement.reconciliation, 'unresolved_unverified_total'))}</dd></div>
          </dl>
        </section>
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-semibold">{t('risk_blockers')}</h2>
          {statement.blockers.length === 0 ? (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-500">{t('no_blockers')}</div>
          ) : (
            <div className="mt-4 space-y-2">
              {statement.blockers.map((item, index) => {
                const blocker = typeof item === 'object' && item ? item as Record<string, unknown> : {};
                return <div key={`${stringValue(blocker, 'code')}-${index}`} className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
                  <div className="font-medium">{statusLabel(blocker.code)}</div>
                  {blocker.reason ? <div className="mt-1 text-xs opacity-80">{String(blocker.reason)}</div> : null}
                </div>;
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-semibold">{t('lifetime_totals')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(statement.totals).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
              <div className="text-xs uppercase text-zinc-500">{fieldLabel(label)}</div>
              <div className="mt-1 font-semibold">{money(value)}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-semibold">{t('request_destination')}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-zinc-500">{t('seller')}</dt><dd>{statement.user.display_name || statement.user.email || '—'}</dd>
            <dt className="text-zinc-500">{t('requested')}</dt><dd>{money(withdrawal.amount_requested)}</dd>
            <dt className="text-zinc-500">{t('fee')}</dt><dd>{money(withdrawal.fee)}</dd>
            <dt className="text-zinc-500">{t('net')}</dt><dd>{money(withdrawal.amount_net)}</dd>
            <dt className="text-zinc-500">{t('bank')}</dt><dd>{withdrawal.bank_name}</dd>
            <dt className="text-zinc-500">{t('account')}</dt><dd className="font-mono">{withdrawal.bank_account_masked}</dd>
            <dt className="text-zinc-500">{t('holder')}</dt><dd>{withdrawal.bank_account_name}</dd>
            <dt className="text-zinc-500">{t('funding')}</dt><dd>{statusBadge(withdrawal.funding_state)}</dd>
            <dt className="text-zinc-500">{t('status')}</dt><dd>{statusBadge(withdrawal.status)}</dd>
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-semibold">{t('transfer_controls')}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {withdrawal.status === 'pending' && (
              <button disabled={acting} onClick={() => action('verify_for_transfer')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                {t('verify_lock')}
              </button>
            )}
            {withdrawal.status === 'processing' && !withdrawal.transfer_started_at && (
              <>
                <button disabled={acting} onClick={() => action('start_transfer')} className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white disabled:opacity-50">{t('start_transfer')}</button>
                <button disabled={acting} onClick={() => action('release_claim')} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{t('release_claim')}</button>
              </>
            )}
            {withdrawal.status === 'processing' && withdrawal.transfer_started_at && (
              <>
                <button
                  disabled={acting}
                  onClick={() => openActionModal('complete')}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {t('record_completed')}
                </button>
                {statement.actor_role === 'moderator' && <button
                  disabled={acting}
                  onClick={() => openActionModal('mark_failed')}
                  className="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-500 disabled:opacity-50"
                >
                  {t('mark_failed')}
                </button>}
              </>
            )}
            {statement.actor_role === 'moderator' && withdrawal.status === 'processing' && withdrawal.recovery_required && (
              <button
                disabled={acting}
                onClick={() => openActionModal('takeover_recovery')}
                className="rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-500 disabled:opacity-50"
              >
                {t('moderator_takeover')}
              </button>
            )}
            {['pending', 'processing'].includes(withdrawal.status) && !withdrawal.transfer_started_at && (
              <button
                disabled={acting}
                onClick={() => openActionModal('reject')}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >{t('reject_release')}</button>
            )}
            {statement.actor_role === 'moderator' && withdrawal.status === 'completed' && statement.transfer_attempts.some((attempt) => attempt.status === 'confirmed') && (
              <button
                disabled={acting}
                onClick={() => openActionModal('record_returned')}
                className="rounded-lg border border-purple-500 px-4 py-2 text-sm text-purple-500 disabled:opacity-50"
              >
                {t('record_returned')}
              </button>
            )}
            {statement.actor_role === 'moderator' && withdrawal.funding_state.startsWith('legacy_') && withdrawal.status !== 'completed' && (
              <button
                disabled={acting}
                onClick={() => openActionModal('resolve_legacy')}
                className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-500 disabled:opacity-50"
              >
                {t('resolve_legacy')}
              </button>
            )}
          </div>
          {withdrawal.transfer_started_at && (
            <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm font-semibold text-red-500">{t('transfer_started_warning')}</p>
          )}
          {fullDestination && (
            <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div className="font-semibold">{t('start_transfer_destination')}</div>
              <div className="mt-2 text-sm">{fullDestination.bank_name} · {fullDestination.bank_account_number} · {fullDestination.bank_account_name}</div>
              <div className="text-lg font-bold text-orange-500">{t('transfer_exact', { amount: money(fullDestination.amount_net) })}</div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">{t('fund_sources')}</h2>
          <span className="text-xs text-zinc-500">{t('records_count', { count: statement.sources.length })}</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr><th className="px-3 py-2">{t('source_type')}</th><th className="px-3 py-2">{t('original_amount')}</th><th className="px-3 py-2">{t('remaining_amount')}</th><th className="px-3 py-2">{t('verification')}</th><th className="px-3 py-2">{t('credits_wallet')}</th><th className="px-3 py-2">{t('occurred_at')}</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {statement.sources.map((source) => <tr key={stringValue(source, 'id')}>
                <td className="px-3 py-3"><div className="font-medium">{statusLabel(source.source_type)}</div><div className="mt-1 max-w-48 truncate font-mono text-xs text-zinc-500" title={stringValue(source, 'source_id')}>{stringValue(source, 'source_id') || '—'}</div></td>
                <td className="px-3 py-3">{money(numberValue(source, 'original_amount'))}</td>
                <td className="px-3 py-3 font-medium">{money(numberValue(source, 'remaining_amount'))}</td>
                <td className="px-3 py-3">{statusBadge(source.verification_status)}</td>
                <td className="px-3 py-3">{source.credits_wallet === true ? t('yes') : t('no')}</td>
                <td className="px-3 py-3 text-zinc-500">{dateTime(source.occurred_at)}</td>
              </tr>)}
            </tbody>
          </table>
          {statement.sources.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">{t('no_data')}</div>}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">{t('allocations')}</h2><span className="text-xs text-zinc-500">{t('records_count', { count: statement.allocations.length })}</span></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800"><tr><th className="px-3 py-2">{t('purpose')}</th><th className="px-3 py-2">{t('amount')}</th><th className="px-3 py-2">{t('status')}</th><th className="px-3 py-2">{t('created_at')}</th><th className="px-3 py-2">{t('source_reference')}</th></tr></thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {statement.allocations.map((allocation) => <tr key={stringValue(allocation, 'id')}>
                <td className="px-3 py-3"><div className="font-medium">{statusLabel(allocation.purpose_type)}</div><div className="mt-1 font-mono text-xs text-zinc-500">{stringValue(allocation, 'purpose_id')}</div></td>
                <td className="px-3 py-3 font-medium">{money(numberValue(allocation, 'amount'))}</td>
                <td className="px-3 py-3">{statusBadge(allocation.status)}</td>
                <td className="px-3 py-3 text-zinc-500">{dateTime(allocation.created_at)}</td>
                <td className="px-3 py-3 font-mono text-xs text-zinc-500">{stringValue(allocation, 'fund_source_id')}</td>
              </tr>)}
            </tbody>
          </table>
          {statement.allocations.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">{t('no_data')}</div>}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">{t('transaction_timeline')}</h2><span className="text-xs text-zinc-500">{t('records_count', { count: statement.transactions.length })}</span></div>
        <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
          {statement.transactions.map((transaction) => <article key={stringValue(transaction, 'id')} className="flex flex-col gap-3 rounded-xl bg-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-zinc-900">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{statusLabel(transaction.type)}</span><span className="text-xs text-zinc-500">{dateTime(transaction.created_at)}</span></div><p className="mt-1 text-sm text-zinc-500">{stringValue(transaction, 'description') || '—'}</p><p className="mt-1 truncate font-mono text-xs text-zinc-500">{stringValue(transaction, 'reference_id')}</p></div>
            <div className="shrink-0 text-right"><div className="font-semibold">{money(numberValue(transaction, 'amount'))}</div><div className="text-xs text-zinc-500">{t('balance_after')}: {money(numberValue(transaction, 'balance_after'))}</div></div>
          </article>)}
          {statement.transactions.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">{t('no_data')}</div>}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">{t('transfer_attempts')}</h2><span className="text-xs text-zinc-500">{t('records_count', { count: statement.transfer_attempts.length })}</span></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {statement.transfer_attempts.map((attempt, index) => <article key={stringValue(attempt, 'id')} className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-4"><h3 className="font-medium">{t('transfer_attempt_number', { number: statement.transfer_attempts.length - index })}</h3>{statusBadge(attempt.status)}</div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <dt className="text-zinc-500">{t('requested')}</dt><dd className="text-right">{money(numberValue(attempt, 'amount_requested'))}</dd><dt className="text-zinc-500">{t('fee')}</dt><dd className="text-right">{money(numberValue(attempt, 'fee_amount'))}</dd><dt className="text-zinc-500">{t('net')}</dt><dd className="text-right font-semibold">{money(numberValue(attempt, 'amount_net'))}</dd><dt className="text-zinc-500">{t('destination_masked')}</dt><dd className="text-right">{stringValue(attempt, 'destination_bank_name')} · {stringValue(attempt, 'destination_account_masked')}</dd><dt className="text-zinc-500">{t('started_at')}</dt><dd className="text-right">{dateTime(attempt.started_at)}</dd><dt className="text-zinc-500">{t('completed_at')}</dt><dd className="text-right">{dateTime(attempt.completed_at)}</dd><dt className="text-zinc-500">{t('transfer_reference')}</dt><dd className="break-all text-right font-mono">{stringValue(attempt, 'transfer_reference') || '—'}</dd>
            </dl>
            {attempt.failure_reason ? <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{String(attempt.failure_reason)}</div> : null}
          </article>)}
          {statement.transfer_attempts.length === 0 && <div className="col-span-full py-8 text-center text-sm text-zinc-500">{t('no_transfer_attempts')}</div>}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">{t('audit')}</h2><span className="text-xs text-zinc-500">{t('records_count', { count: statement.audit.length })}</span></div>
        <div className="mt-4 space-y-3">
          {statement.audit.map((event) => <article key={stringValue(event, 'id')} className="flex gap-3 border-l-2 border-blue-500 pl-4"><div className="min-w-0"><div className="font-medium">{statusLabel(event.action)}</div><div className="mt-1 text-sm text-zinc-500">{stringValue(event, 'reason') || t('no_reason_provided')}</div><div className="mt-1 text-xs text-zinc-500">{dateTime(event.created_at)} · {statusLabel(event.actor_role)}</div></div></article>)}
          {statement.audit.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">{t('no_data')}</div>}
        </div>
      </section>

      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeActionModal();
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="withdrawal-action-title" className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="withdrawal-action-title" className="text-xl font-semibold">{t(`modal_${modalAction}_title` as AdminTranslationKey)}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{t(`modal_${modalAction}_description` as AdminTranslationKey)}</p>
              </div>
              <button type="button" disabled={acting} onClick={closeActionModal} aria-label={t('close')} className="rounded-lg px-2 py-1 text-xl text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-900">×</button>
            </div>

            {modalAction === 'complete' && (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
                <div className="flex justify-between gap-4"><span className="text-zinc-500">{t('net')}</span><strong className="text-emerald-500">{money(withdrawal.amount_net)}</strong></div>
                <div className="mt-2 flex justify-between gap-4"><span className="text-zinc-500">{t('destination_masked')}</span><span className="text-right">{withdrawal.bank_name} · {withdrawal.bank_account_masked}</span></div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {['complete', 'record_returned'].includes(modalAction) || (modalAction === 'resolve_legacy' && modalForm.outcome === 'confirmed_sent') ? (
                <label className="block text-sm font-medium">{modalAction === 'record_returned' ? t('return_reference_prompt') : t('transfer_reference_prompt')}
                  <input autoFocus value={modalForm.reference} onChange={(event) => setModalForm((current) => ({ ...current, reference: event.target.value }))} placeholder={t('reference_placeholder')} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 font-mono outline-none focus:border-orange-500 dark:border-zinc-700" />
                </label>
              ) : null}

              {['mark_failed', 'reject', 'takeover_recovery', 'resolve_legacy'].includes(modalAction) && (
                <label className="block text-sm font-medium">{modalAction === 'reject' ? t('rejection_reason_prompt') : modalAction === 'takeover_recovery' ? t('takeover_reason_prompt') : modalAction === 'resolve_legacy' ? t('legacy_reason_prompt') : t('bank_failure_reason_prompt')}
                  <textarea autoFocus rows={3} value={modalForm.reason} onChange={(event) => setModalForm((current) => ({ ...current, reason: event.target.value }))} placeholder={t('reason_placeholder')} className="mt-2 w-full resize-none rounded-xl border border-zinc-300 bg-transparent px-4 py-3 outline-none focus:border-orange-500 dark:border-zinc-700" />
                </label>
              )}

              {['mark_failed', 'takeover_recovery', 'record_returned'].includes(modalAction) && (
                <label className="block text-sm font-medium">{modalAction === 'record_returned' ? t('return_evidence_prompt') : modalAction === 'takeover_recovery' ? t('takeover_evidence_prompt') : t('bank_evidence_prompt')}
                  <input value={modalForm.evidenceReference} onChange={(event) => setModalForm((current) => ({ ...current, evidenceReference: event.target.value }))} placeholder={t('evidence_placeholder')} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 outline-none focus:border-orange-500 dark:border-zinc-700" />
                </label>
              )}

              {modalAction === 'mark_failed' && (
                <fieldset><legend className="text-sm font-medium">{t('failure_outcome_label')}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {['pending', 'rejected'].map((outcome) => <label key={outcome} className={`cursor-pointer rounded-xl border p-3 text-sm ${modalForm.outcome === outcome ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-300 dark:border-zinc-700'}`}><input type="radio" name="failure-outcome" value={outcome} checked={modalForm.outcome === outcome} onChange={(event) => setModalForm((current) => ({ ...current, outcome: event.target.value }))} className="mr-2" />{outcome === 'pending' ? t('outcome_pending') : t('outcome_rejected')}</label>)}
                </div></fieldset>
              )}

              {modalAction === 'resolve_legacy' && (
                <label className="block text-sm font-medium">{t('legacy_outcome_label')}<select value={modalForm.outcome} onChange={(event) => setModalForm((current) => ({ ...current, outcome: event.target.value, reference: '' }))} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950"><option value="unknown">{t('legacy_unknown')}</option><option value="confirmed_not_sent">{t('legacy_not_sent')}</option><option value="confirmed_sent">{t('legacy_sent')}</option></select></label>
              )}
            </div>

            {modalError && <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{modalError}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={acting} onClick={closeActionModal} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700">{t('cancel')}</button>
              <button type="button" disabled={acting} onClick={() => void submitActionModal()} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${['reject', 'mark_failed'].includes(modalAction) ? 'bg-red-600' : 'bg-orange-500'}`}>{acting ? t('processing_action') : t(`modal_${modalAction}_confirm` as AdminTranslationKey)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
