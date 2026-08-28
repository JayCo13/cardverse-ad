"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, CircleNotch, EnvelopeSimple, PlayCircle, WarningCircle } from '@phosphor-icons/react';

type ContactStatus = 'open' | 'in_progress' | 'resolved';
type ContactRequest = {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    status: ContactStatus;
    created_at: string;
    updated_at: string;
};

function label(status: ContactStatus) {
    return status === 'open' ? 'Mới' : status === 'in_progress' ? 'Đang xử lý' : 'Đã xử lý';
}

export default function ContactRequestDetailPage() {
    const params = useParams<{ id: string }>();
    const [contact, setContact] = useState<ContactRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/contact-requests/${params.id}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Không thể tải yêu cầu liên hệ');
            setContact(payload.request);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Không thể tải yêu cầu liên hệ');
        } finally {
            setIsLoading(false);
        }
    }, [params.id]);

    useEffect(() => { void load(); }, [load]);

    const setStatus = async (status: ContactStatus) => {
        if (!contact || status === contact.status) return;
        setIsUpdating(true);
        setError(null);
        try {
            const response = await fetch(`/api/contact-requests/${contact.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Không thể cập nhật trạng thái');
            setContact(payload.request);
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Không thể cập nhật trạng thái');
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) return <div className="flex min-h-48 items-center justify-center text-zinc-500"><CircleNotch className="mr-2 h-5 w-5 animate-spin" />Đang tải...</div>;
    if (error && !contact) return <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-600 dark:text-red-400"><WarningCircle className="h-5 w-5" />{error}</div>;
    if (!contact) return null;

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-8">
            <Link href="/contact-requests" className="inline-flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600"><ArrowLeft className="h-4 w-4" />Quay lại yêu cầu liên hệ</Link>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3"><div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-500"><EnvelopeSimple className="h-5 w-5" weight="fill" /></div><p className="text-sm text-zinc-500">Yêu cầu liên hệ</p></div>
                        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">{contact.subject}</h1>
                        <p className="mt-2 text-sm text-zinc-500">Gửi lúc {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(contact.created_at))}</p>
                    </div>
                    <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{label(contact.status)}</span>
                </div>

                <div className="mt-8 grid gap-6 border-y border-zinc-100 py-6 text-sm dark:border-zinc-800 sm:grid-cols-2">
                    <div><p className="text-zinc-500">Người gửi</p><p className="mt-1 font-semibold text-zinc-900 dark:text-white">{contact.name}</p></div>
                    <div><p className="text-zinc-500">Email phản hồi</p><a href={`mailto:${contact.email}`} className="mt-1 inline-block font-semibold text-orange-500 hover:text-orange-600">{contact.email}</a></div>
                </div>

                <div className="mt-6"><p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Nội dung</p><p className="mt-3 whitespace-pre-wrap leading-7 text-zinc-600 dark:text-zinc-300">{contact.message}</p></div>

                {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="mt-8 flex flex-wrap gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                    <button disabled={isUpdating || contact.status === 'in_progress'} onClick={() => void setStatus('in_progress')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><PlayCircle className="h-4 w-4" weight="fill" />Đang xử lý</button>
                    <button disabled={isUpdating || contact.status === 'resolved'} onClick={() => void setStatus('resolved')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle className="h-4 w-4" weight="fill" />Đánh dấu đã xử lý</button>
                    <button disabled={isUpdating || contact.status === 'open'} onClick={() => void setStatus('open')} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Mở lại</button>
                </div>
            </div>
        </div>
    );
}
