"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
    EnvelopeSimple, CircleNotch, WarningCircle, MagnifyingGlass,
    PaperPlaneTilt, X, UsersThree, UserCircle, CheckCircle, PencilSimpleLine,
    ClockCounterClockwise, Eye, ArrowsClockwise, Smiley
} from "@phosphor-icons/react";

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface Subscriber {
    id: string;
    email: string;
    created_at: string;
}

interface SentEmail {
    id: string;
    subject: string;
    message: string;
    recipient_type: 'all' | 'specific';
    recipient_emails: string[];
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    sent_by: string;
    status: 'sent' | 'partial' | 'failed';
    created_at: string;
}

export default function SubscribersPage() {
    // Tab state
    const [activeTab, setActiveTab] = useState<'subscribers' | 'sent'>('subscribers');

    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination (subscribers)
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalSubscribers, setTotalSubscribers] = useState(0);
    const limit = 10;

    // Filter & Search (subscribers)
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Sent emails state
    const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
    const [isSentLoading, setIsSentLoading] = useState(false);
    const [sentPage, setSentPage] = useState(1);
    const [sentTotalPages, setSentTotalPages] = useState(1);
    const [sentTotal, setSentTotal] = useState(0);
    const [sentSearch, setSentSearch] = useState("");
    const [debouncedSentSearch, setDebouncedSentSearch] = useState("");
    const sentLimit = 10;

    // View detail modal
    const [viewingEmail, setViewingEmail] = useState<SentEmail | null>(null);

    // Compose Email Modal
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
    const [specificEmails, setSpecificEmails] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailMessage, setEmailMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Load subscribers
    const loadSubscribers = async (page: number = 1, forceSearchStr?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const currentSearch = forceSearchStr ?? debouncedSearch;
            let queryUrl = `/api/subscribers?page=${page}&limit=${limit}`;
            if (currentSearch) queryUrl += `&search=${encodeURIComponent(currentSearch)}`;

            const res = await fetch(queryUrl);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to load subscribers");
            }
            const data = await res.json();

            setSubscribers(data.subscribers || []);
            setTotalSubscribers(data.total || 0);
            setTotalPages(Math.max(1, Math.ceil((data.total || 0) / limit)));
            setCurrentPage(page);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    };

    // Load sent emails
    const loadSentEmails = async (page: number = 1, forceSearchStr?: string) => {
        setIsSentLoading(true);
        try {
            const currentSearch = forceSearchStr ?? debouncedSentSearch;
            let queryUrl = `/api/subscribers/mail?page=${page}&limit=${sentLimit}`;
            if (currentSearch) queryUrl += `&search=${encodeURIComponent(currentSearch)}`;

            const res = await fetch(queryUrl);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to load sent emails");
            }
            const data = await res.json();

            setSentEmails(data.emails || []);
            setSentTotal(data.total || 0);
            setSentTotalPages(Math.max(1, Math.ceil((data.total || 0) / sentLimit)));
            setSentPage(page);
        } catch (err: unknown) {
            console.error('Failed to load sent emails:', err);
        } finally {
            setIsSentLoading(false);
        }
    };

    // Debounce subscribers search
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        loadSubscribers(1, debouncedSearch);
    }, [debouncedSearch]);

    // Debounce sent emails search
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSentSearch(sentSearch), 300);
        return () => clearTimeout(handler);
    }, [sentSearch]);

    useEffect(() => {
        if (activeTab === 'sent') {
            loadSentEmails(1, debouncedSentSearch);
        }
    }, [debouncedSentSearch, activeTab]);

    const handleEmojiClick = (emojiObj: { emoji: string }) => {
        const emoji = emojiObj.emoji;
        const ref = textareaRef.current;
        if (ref) {
            const start = ref.selectionStart;
            const end = ref.selectionEnd;
            const text = emailMessage;
            const newText = text.substring(0, start) + emoji + text.substring(end);
            setEmailMessage(newText);
            
            setTimeout(() => {
                ref.selectionStart = ref.selectionEnd = start + emoji.length;
                ref.focus();
            }, 10);
        } else {
            setEmailMessage(prev => prev + emoji);
        }
        setShowEmojiPicker(false);
    };

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        setSendResult(null);

        try {
            const recipients = recipientMode === 'all'
                ? 'all'
                : specificEmails.split(',').map(e => e.trim()).filter(e => e.length > 0);

            if (recipientMode === 'specific' && (!Array.isArray(recipients) || recipients.length === 0)) {
                setSendResult({ success: false, message: "Please enter at least one valid email address." });
                setIsSending(false);
                return;
            }

            const res = await fetch('/api/subscribers/mail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipients, subject: emailSubject, message: emailMessage }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send email');
            }

            setSendResult({
                success: true,
                message: `Successfully sent to ${data.sent} recipient(s)${data.failed > 0 ? `. ${data.failed} failed.` : '.'}`
            });

            setTimeout(() => {
                setEmailSubject("");
                setEmailMessage("");
                setSpecificEmails("");
                setSendResult(null);
                setIsComposeOpen(false);
                // Refresh sent emails if on that tab
                if (activeTab === 'sent') loadSentEmails(1);
            }, 3000);

        } catch (err: unknown) {
            setSendResult({
                success: false,
                message: err instanceof Error ? err.message : 'Unknown error'
            });
        } finally {
            setIsSending(false);
        }
    };

    const openComposeForSubscriber = (email: string) => {
        setRecipientMode('specific');
        setSpecificEmails(email);
        setIsComposeOpen(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sent':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-500 border border-green-500/20">✓ Sent</span>;
            case 'partial':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">⚠ Partial</span>;
            case 'failed':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">✕ Failed</span>;
            default:
                return <span className="text-xs text-zinc-500">{status}</span>;
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                        <EnvelopeSimple className="w-8 h-8 text-orange-500" />
                        Newsletter & Emails
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage subscribers and email communications.</p>
                </div>

                <button
                    onClick={() => {
                        setRecipientMode('all');
                        setSpecificEmails('');
                        setSendResult(null);
                        setIsComposeOpen(true);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-400 text-black px-4 py-2 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-orange-500/20"
                >
                    <PencilSimpleLine weight="bold" />
                    Compose Email
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setActiveTab('subscribers')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'subscribers'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                >
                    <UsersThree className="w-4 h-4" />
                    Subscribers
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full">{totalSubscribers}</span>
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'sent'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                >
                    <ClockCounterClockwise className="w-4 h-4" />
                    Sent Emails
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full">{sentTotal}</span>
                </button>
            </div>

            {/* =================== SUBSCRIBERS TAB =================== */}
            {activeTab === 'subscribers' && (
                <>
                    {/* Search Bar */}
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-4 shadow-sm backdrop-blur-xl transition-colors duration-300">
                        <div className="relative w-full md:w-auto flex-1 max-w-md group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlass className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search subscriber email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Subscribers Table */}
                    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-xl transition-colors duration-300">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                                <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Email Address</th>
                                        <th className="px-6 py-4">Subscribed Date</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center">
                                                <CircleNotch className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                                            </td>
                                        </tr>
                                    ) : subscribers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                                No subscribers found.
                                            </td>
                                        </tr>
                                    ) : (
                                        subscribers.map((sub) => (
                                            <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs">{sub.id.slice(0, 8)}...</td>
                                                <td className="px-6 py-4 text-zinc-900 dark:text-zinc-200 font-medium">{sub.email}</td>
                                                <td className="px-6 py-4">{new Date(sub.created_at).toLocaleDateString()} {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => openComposeForSubscriber(sub.email)}
                                                        className="p-2 text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                                                        title={`Send email to ${sub.email}`}
                                                    >
                                                        <PaperPlaneTilt className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/50 transition-colors duration-300">
                                <button onClick={() => loadSubscribers(currentPage - 1)} disabled={currentPage === 1 || isLoading}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                                <span className="text-sm text-zinc-500">
                                    Page <span className="text-zinc-900 dark:text-zinc-300 font-medium">{currentPage}</span> of <span className="text-zinc-900 dark:text-zinc-300 font-medium">{totalPages}</span> ({totalSubscribers} total)
                                </span>
                                <button onClick={() => loadSubscribers(currentPage + 1)} disabled={currentPage >= totalPages || isLoading}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* =================== SENT EMAILS TAB =================== */}
            {activeTab === 'sent' && (
                <>
                    {/* Search Bar */}
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-4 shadow-sm backdrop-blur-xl transition-colors duration-300">
                        <div className="relative w-full md:w-auto flex-1 max-w-md group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlass className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by subject or sender..."
                                value={sentSearch}
                                onChange={(e) => setSentSearch(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm"
                            />
                        </div>
                        <button
                            onClick={() => loadSentEmails(sentPage)}
                            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-orange-500 transition-colors"
                        >
                            <ArrowsClockwise className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>

                    {/* Sent Emails Table */}
                    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-xl transition-colors duration-300">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                                <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-4">Subject</th>
                                        <th className="px-6 py-4">Recipients</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Sent By</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                                    {isSentLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <CircleNotch className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                                            </td>
                                        </tr>
                                    ) : sentEmails.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                                                No emails sent yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        sentEmails.map((email) => (
                                            <tr key={email.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="text-zinc-900 dark:text-zinc-200 font-medium line-clamp-1">{email.subject}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {email.recipient_type === 'all' ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500">
                                                            <UsersThree className="w-3.5 h-3.5" />
                                                            All ({email.recipient_count})
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-zinc-500">
                                                            {email.recipient_count} recipient{email.recipient_count !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">{getStatusBadge(email.status)}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs text-zinc-500">{email.sent_by.split(':')[0]}</span>
                                                </td>
                                                <td className="px-6 py-4 text-xs whitespace-nowrap">
                                                    {new Date(email.created_at).toLocaleDateString()}{' '}
                                                    {new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setViewingEmail(email)}
                                                        className="p-2 text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/50 transition-colors duration-300">
                                <button onClick={() => loadSentEmails(sentPage - 1)} disabled={sentPage === 1 || isSentLoading}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                                <span className="text-sm text-zinc-500">
                                    Page <span className="text-zinc-900 dark:text-zinc-300 font-medium">{sentPage}</span> of <span className="text-zinc-900 dark:text-zinc-300 font-medium">{sentTotalPages}</span> ({sentTotal} total)
                                </span>
                                <button onClick={() => loadSentEmails(sentPage + 1)} disabled={sentPage >= sentTotalPages || isSentLoading}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* =================== COMPOSE EMAIL MODAL =================== */}
            <AnimatePresence>
                {isComposeOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-zinc-900/40 dark:bg-black/80 backdrop-blur-sm z-40"
                            onClick={() => setIsComposeOpen(false)} />

                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto transition-colors duration-300">
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                            <PaperPlaneTilt weight="fill" className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Compose Email</h2>
                                    </div>
                                    <button onClick={() => setIsComposeOpen(false)}
                                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100/50 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <form onSubmit={handleSendEmail} className="space-y-4">
                                    {/* Recipient Selection */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Recipients</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setRecipientMode('all')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${recipientMode === 'all' ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                                                <UsersThree weight={recipientMode === 'all' ? 'fill' : 'regular'} className="w-4 h-4" />
                                                All Subscribers
                                            </button>
                                            <button type="button" onClick={() => setRecipientMode('specific')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${recipientMode === 'specific' ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                                                <UserCircle weight={recipientMode === 'specific' ? 'fill' : 'regular'} className="w-4 h-4" />
                                                Specific Email(s)
                                            </button>
                                        </div>
                                        {recipientMode === 'all' && (
                                            <p className="text-xs text-zinc-500 ml-1">
                                                This will send to all <span className="text-orange-500 font-semibold">{totalSubscribers}</span> subscribers.
                                            </p>
                                        )}
                                        {recipientMode === 'specific' && (
                                            <input type="text" placeholder="email1@example.com, email2@example.com" value={specificEmails}
                                                onChange={(e) => setSpecificEmails(e.target.value)}
                                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl py-2.5 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm" />
                                        )}
                                    </div>

                                    {/* Subject */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Subject</label>
                                        <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Enter email subject..." required
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl py-2.5 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium text-sm" />
                                    </div>

                                    {/* Message */}
                                    <div className="space-y-1 relative">
                                        <div className="flex items-center justify-between ml-1">
                                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Message</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="text-zinc-400 hover:text-orange-500 transition-colors flex items-center gap-1 text-xs font-semibold"
                                            >
                                                <Smiley className="w-4 h-4" />
                                                Add Icon
                                            </button>
                                        </div>
                                        <textarea 
                                            ref={textareaRef}
                                            value={emailMessage} 
                                            onChange={(e) => setEmailMessage(e.target.value)} 
                                            placeholder="Write your message here..." required rows={6}
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl py-3 px-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm resize-none leading-relaxed" 
                                        />
                                        
                                        {/* Emoji Picker Popover */}
                                        <AnimatePresence>
                                            {showEmojiPicker && (
                                                <motion.div 
                                                    initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                                                    animate={{ opacity: 1, scale: 1, y: 0 }} 
                                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    className="absolute z-50 right-0 top-8 shadow-2xl rounded-2xl overflow-hidden"
                                                >
                                                    <EmojiPicker onEmojiClick={handleEmojiClick} />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Result */}
                                    {sendResult && (
                                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                            className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${sendResult.success ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                                            {sendResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <WarningCircle className="w-5 h-5 shrink-0" />}
                                            <p>{sendResult.message}</p>
                                        </motion.div>
                                    )}

                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={isSending} type="submit"
                                        className="w-full py-3 mt-2 bg-gradient-to-r from-orange-500 to-orange-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
                                        {isSending ? (<><CircleNotch className="w-5 h-5 animate-spin" />Sending...</>) : (<><PaperPlaneTilt weight="bold" className="w-5 h-5" />Send Email</>)}
                                    </motion.button>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* =================== VIEW EMAIL DETAIL MODAL =================== */}
            <AnimatePresence>
                {viewingEmail && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-zinc-900/40 dark:bg-black/80 backdrop-blur-sm z-40"
                            onClick={() => setViewingEmail(null)} />

                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-50 overflow-hidden max-h-[90vh] overflow-y-auto transition-colors duration-300">
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                            <EnvelopeSimple weight="fill" className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Email Details</h2>
                                    </div>
                                    <button onClick={() => setViewingEmail(null)}
                                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100/50 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Subject */}
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Subject</span>
                                        <p className="text-zinc-900 dark:text-white font-semibold">{viewingEmail.subject}</p>
                                    </div>

                                    {/* Status & Stats */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5 text-center">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Status</span>
                                            {getStatusBadge(viewingEmail.status)}
                                        </div>
                                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5 text-center">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Sent</span>
                                            <span className="text-green-500 font-bold">{viewingEmail.sent_count}</span>
                                        </div>
                                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5 text-center">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Failed</span>
                                            <span className={`font-bold ${viewingEmail.failed_count > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{viewingEmail.failed_count}</span>
                                        </div>
                                    </div>

                                    {/* Message Body */}
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Message</span>
                                        <p className="text-zinc-700 dark:text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{viewingEmail.message}</p>
                                    </div>

                                    {/* Recipients */}
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-white/5">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                                            Recipients ({viewingEmail.recipient_count})
                                        </span>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {viewingEmail.recipient_emails.map((email, i) => (
                                                <p key={i} className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">{email}</p>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center justify-between text-xs text-zinc-500 pt-2">
                                        <span>Sent by: <span className="text-zinc-700 dark:text-zinc-300">{viewingEmail.sent_by}</span></span>
                                        <span>{new Date(viewingEmail.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
