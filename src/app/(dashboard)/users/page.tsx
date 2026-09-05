"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    UsersThree, Trash, Plus, ShieldStar, WarningCircle,
    CircleNotch, X, EnvelopeSimple, LockKey, MagnifyingGlass, Funnel, Prohibit, CheckCircle,
    UserPlus, CalendarCheck, Lightning, Sparkle
} from "@phosphor-icons/react";
import { useRole } from "@/context/RoleContext";

interface User {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at?: string;
    app_metadata?: {
        role?: string;
        [key: string]: unknown;
    };
    user_metadata?: {
        banned?: boolean;
        [key: string]: unknown;
    };
}

interface UserStats {
    total: number;
    newToday: number;
    new7d: number;
    new30d: number;
    active30d: number;
    neverActive: number;
    admins: number;
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Vừa xong";
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Vừa xong";
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    return `${Math.floor(diffDays / 30)} tháng trước`;
}

export default function UsersPage() {
    const { isModerator } = useRole();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const limit = 7;

    const [stats, setStats] = useState<UserStats>({
        total: 0,
        newToday: 0,
        new7d: 0,
        new30d: 0,
        active30d: 0,
        neverActive: 0,
        admins: 0,
    });

    // Filter & Search
    const [searchTerm, setSearchTerm] = useState("");
    const [filterOption, setFilterOption] = useState("all");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const loadUsers = async (page: number = 1, forceSearchStr?: string, forceFilterStr?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const currentSearch = forceSearchStr ?? debouncedSearch;
            const currentFilter = forceFilterStr ?? filterOption;

            let queryUrl = `/api/users?page=${page}&limit=${limit}`;
            if (currentSearch) queryUrl += `&search=${encodeURIComponent(currentSearch)}`;
            if (currentFilter !== 'all') queryUrl += `&filter=${encodeURIComponent(currentFilter)}`;

            const res = await fetch(queryUrl);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 403) throw new Error(data.error || "Forbidden: You must be a Moderator to view users.");
                throw new Error(data.error || "Failed to load users");
            }
            const data = await res.json();
            const fetchedUsers = data.users || [];

            // Derive total pages from the total payload
            const total = data.total || 0;
            const calculatedTotalPages = Math.max(1, Math.ceil(total / limit));

            setUsers(fetchedUsers);
            setTotalUsers(total);
            if (data.stats) {
                setStats(data.stats);
            }
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
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Resync when filters or debounced search changes
    useEffect(() => {
        loadUsers(1, debouncedSearch, filterOption);
    }, [debouncedSearch, filterOption]);

    const handleDelete = async (id: string, email: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE the account for ${email}? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete user");
            }
            await loadUsers(currentPage);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleBanToggle = async (id: string, email: string, currentlyBanned: boolean) => {
        const action = currentlyBanned ? 'unban' : 'ban';
        const confirmMsg = currentlyBanned
            ? `Unban ${email}? They will be able to sign in again.`
            : `Ban ${email}? They will no longer be able to sign in.`;
        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Failed to ${action} user`);
            }
            await loadUsers(currentPage);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRoleToggle = async (id: string, email: string, makeAdmin: boolean) => {
        const confirmMsg = makeAdmin
            ? `Cấp quyền ADMIN cho ${email}? Họ sẽ đăng nhập được vào trang admin bằng chính tài khoản hiện tại.`
            : `Thu hồi quyền admin của ${email}? Họ sẽ không vào được trang admin nữa.`;
        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_role', role: makeAdmin ? 'admin' : 'user' })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to update role");
            }
            await loadUsers(currentPage);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setCreateError(null);

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, password: newPassword })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create user");
            }

            setIsModalOpen(false);
            setNewEmail("");
            setNewPassword("");
            await loadUsers(1);
        } catch (err: any) {
            setCreateError(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <ShieldStar className="w-16 h-16 text-yellow-500/50" />
                <h2 className="text-xl font-medium text-zinc-900 dark:text-white">Access Denied</h2>
                <p className="text-zinc-500">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                        <UsersThree className="w-8 h-8 text-orange-500" />
                        User Management
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage system administrators and users.</p>
                </div>

                {isModerator && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-400 text-black px-4 py-2 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-orange-500/20"
                    >
                        <Plus weight="bold" />
                        Create Admin
                    </button>
                )}
            </div>

            {/* Quick Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Users */}
                <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setFilterOption("all")}
                    className={`relative text-left overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200 cursor-pointer ${
                        filterOption === "all"
                            ? "bg-orange-500/5 border-orange-500/40 shadow-orange-500/10 ring-1 ring-orange-500/30 dark:bg-orange-500/[0.08]"
                            : "bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10"
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
                            <UsersThree weight="fill" className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            Tất cả
                        </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tổng người dùng</p>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                            {isLoading && stats.total === 0 ? "..." : stats.total.toLocaleString()}
                        </span>
                        <span className="text-xs text-zinc-400">tài khoản</span>
                    </div>
                </motion.button>

                {/* New in 7 Days */}
                <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setFilterOption("new_7")}
                    className={`relative text-left overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200 cursor-pointer ${
                        filterOption === "new_7"
                            ? "bg-emerald-500/5 border-emerald-500/40 shadow-emerald-500/10 ring-1 ring-emerald-500/30 dark:bg-emerald-500/[0.08]"
                            : "bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10"
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                            <UserPlus weight="fill" className="h-5 w-5" />
                        </div>
                        {stats.newToday > 0 ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                +{stats.newToday} hôm nay
                            </span>
                        ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                7 ngày qua
                            </span>
                        )}
                    </div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">User mới gần đây</p>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                            {isLoading && stats.new7d === 0 ? "..." : stats.new7d.toLocaleString()}
                        </span>
                        <span className="text-xs text-zinc-400">trong 7 ngày</span>
                    </div>
                </motion.button>

                {/* New in 30 Days */}
                <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setFilterOption("new_30")}
                    className={`relative text-left overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200 cursor-pointer ${
                        filterOption === "new_30"
                            ? "bg-sky-500/5 border-sky-500/40 shadow-sky-500/10 ring-1 ring-sky-500/30 dark:bg-sky-500/[0.08]"
                            : "bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10"
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-500">
                            <CalendarCheck weight="fill" className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            30 ngày qua
                        </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">User mới trong tháng</p>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
                            {isLoading && stats.new30d === 0 ? "..." : stats.new30d.toLocaleString()}
                        </span>
                        <span className="text-xs text-zinc-400">trong 30 ngày</span>
                    </div>
                </motion.button>

                {/* Active in 30 Days */}
                <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setFilterOption("active_30")}
                    className={`relative text-left overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200 cursor-pointer ${
                        filterOption === "active_30"
                            ? "bg-purple-500/5 border-purple-500/40 shadow-purple-500/10 ring-1 ring-purple-500/30 dark:bg-purple-500/[0.08]"
                            : "bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10"
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500">
                            <Lightning weight="fill" className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            Hoạt động
                        </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Đang hoạt động</p>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                            {isLoading && stats.active30d === 0 ? "..." : stats.active30d.toLocaleString()}
                        </span>
                        <span className="text-xs text-zinc-400">trong 30 ngày</span>
                    </div>
                </motion.button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-4 shadow-sm backdrop-blur-xl transition-colors duration-300">
                <div className="relative w-full md:w-auto flex-1 max-w-md group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlass className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by email or ID..."
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
                        value={filterOption}
                        onChange={(e) => setFilterOption(e.target.value)}
                        className="appearance-none w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-10 text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all text-sm cursor-pointer"
                    >
                        <option value="all">Tất cả người dùng (All Users)</option>
                        {isModerator && (
                            <>
                                <option value="role_admin">Admins Only</option>
                                <option value="role_user">Users Only</option>
                            </>
                        )}
                        <option value="new_7">User mới gần đây (7 ngày)</option>
                        <option value="new_30">User mới trong tháng (30 ngày)</option>
                        <option value="active_30">Đang hoạt động gần đây (30 ngày)</option>
                        <option value="never_signed_in">Chưa từng đăng nhập</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-zinc-500">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-xl transition-colors duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                        <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Email</th>
                                {isModerator && <th className="px-6 py-4">Role</th>}
                                <th className="px-6 py-4">Created Date</th>
                                <th className="px-6 py-4">Last Sign In</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={isModerator ? 6 : 5} className="px-6 py-12 text-center">
                                        <CircleNotch className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={isModerator ? 6 : 5} className="px-6 py-12 text-center text-zinc-500">
                                        No users found in Supabase Auth.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const createdAtTime = new Date(user.created_at).getTime();
                                    const isNew7d = Date.now() - createdAtTime < 7 * 24 * 60 * 60 * 1000;
                                    const isNew24h = Date.now() - createdAtTime < 24 * 60 * 60 * 1000;

                                    return (
                                        <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">{user.id.slice(0, 8)}...</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <a href={`/users/${user.id}`} className="text-zinc-900 dark:text-zinc-200 font-medium hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
                                                        {user.email}
                                                    </a>
                                                    {isNew24h ? (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/15 text-orange-500 border border-orange-500/30">
                                                            <Sparkle weight="fill" className="w-2.5 h-2.5" />
                                                            Hôm nay
                                                        </span>
                                                    ) : isNew7d ? (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                                                            <Sparkle weight="fill" className="w-2.5 h-2.5" />
                                                            Mới
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            {isModerator && (
                                                <td className="px-6 py-4">
                                                    {user.app_metadata?.role === 'admin' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                                                            <ShieldStar weight="fill" className="w-3 h-3" />
                                                            Admin
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20 dark:border-zinc-600/30">
                                                            User
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                                                    {new Date(user.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                    {formatRelativeTime(user.created_at)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.last_sign_in_at ? (
                                                    <div>
                                                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                                                            {new Date(user.last_sign_in_at).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                            {formatRelativeTime(user.last_sign_in_at)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">Chưa đăng nhập</span>
                                                )}
                                            </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => window.location.href = `/users/${user.id}`}
                                                className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-white/10 rounded-lg transition-colors"
                                                title="View Details"
                                            >
                                                <UsersThree className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleBanToggle(user.id, user.email, !!user.user_metadata?.banned)}
                                                className={`p-2 rounded-lg transition-colors ${user.user_metadata?.banned
                                                    ? 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-400/10'
                                                    : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'
                                                    }`}
                                                title={user.user_metadata?.banned ? 'Unban User' : 'Ban User'}
                                            >
                                                {user.user_metadata?.banned ? (
                                                    <CheckCircle className="w-5 h-5" />
                                                ) : (
                                                    <Prohibit className="w-5 h-5" />
                                                )}
                                            </button>
                                            {isModerator && (
                                                <button
                                                    onClick={() => handleRoleToggle(user.id, user.email, user.app_metadata?.role !== 'admin')}
                                                    className={`p-2 rounded-lg transition-colors ${user.app_metadata?.role === 'admin'
                                                        ? 'text-orange-500 hover:text-red-400 hover:bg-red-400/10'
                                                        : 'text-zinc-500 hover:text-orange-400 hover:bg-orange-400/10'
                                                        }`}
                                                    title={user.app_metadata?.role === 'admin' ? 'Thu hồi quyền Admin' : 'Cấp quyền Admin'}
                                                >
                                                    <ShieldStar weight={user.app_metadata?.role === 'admin' ? 'fill' : 'regular'} className="w-5 h-5" />
                                                </button>
                                            )}
                                            {isModerator && (
                                                <button
                                                    onClick={() => handleDelete(user.id, user.email)}
                                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                    title="Delete User (Permanent)"
                                                >
                                                    <Trash className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/50 transition-colors duration-300">
                        <button
                            onClick={() => loadUsers(currentPage - 1)}
                            disabled={currentPage === 1 || isLoading}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-zinc-500">
                            Page <span className="text-zinc-300 font-medium">{currentPage}</span> of <span className="text-zinc-300 font-medium">{totalPages}</span> ({totalUsers} total)
                        </span>
                        <button
                            onClick={() => loadUsers(currentPage + 1)}
                            disabled={currentPage >= totalPages || isLoading}
                            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Admin Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-zinc-900/40 dark:bg-black/80 backdrop-blur-sm z-40 transition-colors duration-300"
                            onClick={() => setIsModalOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-50 overflow-hidden transition-colors duration-300"
                        >
                            {/* Background accent */}
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                            <ShieldStar weight="fill" className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">New Admin</h2>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100/50 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateAdmin} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Email</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <EnvelopeSimple className="w-5 h-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                                            </div>
                                            <input
                                                type="email"
                                                value={newEmail}
                                                onChange={(e) => setNewEmail(e.target.value)}
                                                placeholder="admin@cardverse.com"
                                                required
                                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Secure Password</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <LockKey className="w-5 h-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                                            </div>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Minimum 6 characters"
                                                required
                                                minLength={6}
                                                className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    {createError && (
                                        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                            <WarningCircle className="w-5 h-5 shrink-0" />
                                            <p>{createError}</p>
                                        </div>
                                    )}

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={isCreating}
                                        className="w-full py-3 mt-4 bg-white text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isCreating ? (
                                            <CircleNotch className="w-5 h-5 animate-spin" />
                                        ) : (
                                            "Create Account"
                                        )}
                                    </motion.button>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
