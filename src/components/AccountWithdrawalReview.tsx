"use client";
import { useState } from 'react';

export function AccountWithdrawalReview({ statement }: { statement: { withdrawal: { id: string }; account_banned?: boolean; account_holds?: Array<{ id: string; event: { reason: string } }> } | null }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  if (!statement?.account_holds?.length && !statement?.account_banned) return null;
  const submit = async () => {
    if (!statement || busy) return;
    setBusy(true); setError('');
    const requestKey = key || crypto.randomUUID(); setKey(requestKey);
    try {
      const response = await fetch(`/api/withdrawals/${statement.withdrawal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey }, body: JSON.stringify({ action: 'resolve_account_hold', payload: { reason: reason.trim() } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không thể xử lý');
      window.location.reload();
    } catch (error) { setError(error instanceof Error ? error.message : 'Không thể xử lý'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border border-amber-500 p-4">
    <h2 className="font-bold">Cần xử lý do khóa tài khoản</h2>
    {statement?.account_holds?.map(hold => <p key={hold.id} className="whitespace-pre-wrap break-words">{hold.event?.reason}</p>)}
    <p>Khoản chuyển đã bắt đầu vẫn phải ghi nhận kết quả thực tế. Bạn có thể từ chối khoản rút bằng thao tác hiện có.</p>
    {statement?.account_banned ? <p>Cần mở khóa tài khoản trước khi bỏ khoản giữ để tiếp tục xét duyệt chuyển tiền.</p> : <>
      <label className="block">Lý do bỏ khoản giữ (10–1.000 ký tự)<textarea disabled={busy} value={reason} onChange={e => { setReason(e.target.value); setKey(''); }} maxLength={1000} className="mt-2 w-full rounded border bg-transparent p-2" /></label>
      <button disabled={busy || reason.trim().length < 10} onClick={submit} className="rounded bg-amber-500 px-4 py-2 disabled:opacity-40">{busy ? 'Đang xử lý…' : 'Bỏ khoản giữ và tiếp tục xét duyệt'}</button>
    </>}
    {error && <p role="alert" className="text-red-500">{error}</p>}
  </section>;
}
