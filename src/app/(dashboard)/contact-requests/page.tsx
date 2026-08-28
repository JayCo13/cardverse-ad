"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatText, CircleNotch, EnvelopeSimple, WarningCircle } from '@phosphor-icons/react';

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

const FILTERS: Array<{ value: ContactStatus | 'all'; label: string }> = [
    { value: 'open', label: 'Mới' },
    { value: 'in_progress', label: 'Đang xử lý' },
    { value: 'resolved', label: 'Đã xử lý' },
    { value: 'all', label: 'Tất cả' },
];

function statusLabel(status: ContactStatus) {
    return status === 'open' ? 'Mới' : status === 'in_progress' ? 'Đang xử lý' : 'Đã xử lý';
}

function statusClass(status: ContactStatus) {
    return status === 'open'
        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
        : status === 'in_progress'
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
}

export default function ContactRequestsPage() {
    const [filter, setFilter] = useState<ContactStatus | 'all'>('open');
    const [requests, setRequests] = useState<ContactRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRequests = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const query = filter === 'all' ? '' : `?status=${filter}`;
            const response = await fetch(`/api/contact-requests${query}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Không thể tải yêu cầu liên hệ');
            setRequests(payload.requests || []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Không thể tải yêu cầu liên hệ');
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    useEffect(() => { void loadRequests(); }, [loadRequests]);

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Yêu cầu liên hệ</h1>
                    <p className="mt-1 text-sm text-zinc-500">Tin nhắn gửi từ trang Liên hệ của CardVerseHub.</p>
                </div>
                <button onClick={() => void loadRequests()} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
                    Làm mới
                </button>
            </div>

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lọc yêu cầu liên hệ">
                {FILTERS.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => setFilter(item.value)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${filter === item.value ? 'bg-orange-500 text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex min-h-48 items-center justify-center text-zinc-500"><CircleNotch className="mr-2 h-5 w-5 animate-spin" />Đang tải...</div>
            ) : error ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-600 dark:text-red-400"><WarningCircle className="h-5 w-5" />{error}</div>
            ) : requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-800">
                    <ChatText className="mx-auto h-10 w-10 text-zinc-400" />
                    <p className="mt-3 font-medium text-zinc-700 dark:text-zinc-200">Không có yêu cầu liên hệ</p>
                    <p className="mt-1 text-sm text-zinc-500">Các tin nhắn mới sẽ xuất hiện ở đây ngay khi người dùng gửi.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                    {requests.map((contact) => (
                        <Link key={contact.id} href={`/contact-requests/${contact.id}`} className="block border-b border-zinc-100 p-5 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/70">
                            <div className="flex items-start gap-4">
                                <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-500"><EnvelopeSimple className="h-5 w-5" weight="fill" /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-zinc-900 dark:text-white">{contact.subject}</p>
                                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(contact.status)}`}>{statusLabel(contact.status)}</span>
                                    </div>
                                    <p className="mt-1 text-sm text-zinc-500">{contact.name} · {contact.email}</p>
                                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{contact.message}</p>
                                </div>
                                <time className="shrink-0 text-xs text-zinc-400" dateTime={contact.created_at}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(contact.created_at))}</time>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
