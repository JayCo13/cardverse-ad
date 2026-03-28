"use client";

import { useState, useEffect } from "react";
import { CurrencyDollar, CircleNotch, WarningCircle, MagnifyingGlass, Funnel, ArrowSquareOut, CheckCircle, Clock } from "@phosphor-icons/react";

interface PaymentOrder {
    id: string;
    user_id: string;
    user_email: string;
    order_code: number;
    package_type: string;
    amount: number;
    status: string;
    created_at: string;
    paid_at?: string;
    payos_checkout_url?: string;
}

export default function PaymentsPage() {
    const [payments, setPayments] = useState<PaymentOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalPayments, setTotalPayments] = useState(0);
    const limit = 10;

    // Filter & Search
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const loadPayments = async (page: number = 1, forceSearchStr?: string, forceStatusStr?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const currentSearch = forceSearchStr ?? debouncedSearch;
            const currentStatus = forceStatusStr ?? statusFilter;

            let queryUrl = `/api/payments?page=${page}&limit=${limit}`;
            if (currentSearch) queryUrl += `&search=${encodeURIComponent(currentSearch)}`;
            if (currentStatus !== 'all') queryUrl += `&status=${encodeURIComponent(currentStatus)}`;

            const res = await fetch(queryUrl);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 403) throw new Error(data.error || "Forbidden: You must be a Moderator to view payments.");
                throw new Error(data.error || "Failed to load payments");
            }
            const data = await res.json();
            const fetchedList = data.payments || [];

            const total = data.total || 0;
            const calculatedTotalPages = Math.max(1, Math.ceil(total / limit));

            setPayments(fetchedList);
            setTotalPayments(total);
            setTotalPages(calculatedTotalPages);
            setCurrentPage(page);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounce search effect
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Reload when search or filters change
    useEffect(() => {
        loadPayments(1, debouncedSearch, statusFilter);
    }, [debouncedSearch, statusFilter]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <WarningCircle className="w-16 h-16 text-yellow-500/50" />
                <h2 className="text-xl font-medium text-zinc-900 dark:text-white">Access Denied / Error</h2>
                <p className="text-zinc-500">{error}</p>
            </div>
        );
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                        <CurrencyDollar className="w-8 h-8 text-orange-500" />
                        Payments & Transactions
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Review all completed and pending payment orders across the platform.</p>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-4 shadow-sm backdrop-blur-xl transition-colors duration-300">
                <div className="relative w-full md:w-auto flex-1 max-w-md group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlass className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Order Code or User ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm"
                    />
                </div>

                <div className="relative w-full md:w-auto min-w-[200px] group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Funnel className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="appearance-none w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-10 text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm cursor-pointer"
                    >
                        <option value="all">All Statuses</option>
                        <option value="paid">Paid & Completed</option>
                        <option value="pending">Pending Payment</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-zinc-500">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-xl transition-colors duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                        <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-medium whitespace-nowrap">
                            <tr>
                                <th className="px-6 py-4">Order Code</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Package</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Created</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <CircleNotch className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                                        No payments found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                payments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-300">#{payment.order_code}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-zinc-900 dark:text-zinc-200 font-medium">{payment.user_email}</span>
                                                <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-mono">{payment.user_id.slice(0, 13)}...</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 capitalize text-zinc-600 dark:text-zinc-300">{payment.package_type.replace('_', ' ')}</td>
                                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{formatCurrency(payment.amount)}</td>
                                        <td className="px-6 py-4">
                                            {payment.status === 'paid' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    <CheckCircle weight="fill" /> Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                    <Clock weight="fill" /> Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs whitespace-nowrap">
                                            {new Date(payment.created_at).toLocaleDateString()} {new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {payment.payos_checkout_url && payment.status === 'pending' && (
                                                <a
                                                    href={payment.payos_checkout_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-xs font-medium"
                                                >
                                                    PayOS Link <ArrowSquareOut />
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/50 transition-colors duration-300">
                        <button
                            onClick={() => loadPayments(currentPage - 1)}
                            disabled={currentPage === 1 || isLoading}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-zinc-500">
                            Page <span className="text-zinc-300 font-medium">{currentPage}</span> of <span className="text-zinc-300 font-medium">{totalPages}</span> ({totalPayments} total)
                        </span>
                        <button
                            onClick={() => loadPayments(currentPage + 1)}
                            disabled={currentPage >= totalPages || isLoading}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
