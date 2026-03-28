"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, MagnifyingGlass, SignOut, ShieldStar, UserCircle, Sun, Moon } from "@phosphor-icons/react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useTheme } from "next-themes";
import Link from "next/link";

type Notification = {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    link?: string;
};

type Badges = {
    pendingKYC: number;
    disputedOrders: number;
    newOrders24h: number;
};

export function Topbar() {
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();
    const { role, isModerator } = useRole();
    const { theme, setTheme } = useTheme();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [badges, setBadges] = useState<Badges>({ pendingKYC: 0, disputedOrders: 0, newOrders24h: 0 });
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch notifications on mount and periodically
    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
            if (data.badges) setBadges(data.badges);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30_000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    // Refresh on page navigation
    useEffect(() => {
        fetchNotifications();
    }, [pathname]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
        router.push("/login");
    };

    const handleNotificationClick = (notification: Notification) => {
        setIsOpen(false);
        if (notification.link) {
            router.push(notification.link);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'kyc_pending': return '🔔';
            case 'kyc_approved': return '✅';
            case 'kyc_rejected': return '❌';
            case 'dispute': return '⚠️';
            case 'order': return '🛒';
            default: return '📌';
        }
    };

    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h trước`;
        const days = Math.floor(hours / 24);
        return `${days} ngày trước`;
    };

    return (
        <div className="flex h-16 shrink-0 items-center justify-between border-b bg-white border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 px-6 transition-colors duration-300">

            {/* Search Bar */}
            <div className="flex flex-1 items-center">
                <div className="relative w-full max-w-md">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MagnifyingGlass className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                    </div>
                    <input
                        id="search"
                        name="search"
                        className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 sm:text-sm sm:leading-6 transition-colors
                                 bg-zinc-100 text-zinc-900 placeholder:text-zinc-500 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-orange-500
                                 dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
                        placeholder="Search across all resources..."
                        type="search"
                    />
                </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
                {/* Role Badge */}
                {role && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${isModerator
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}>
                        {isModerator ? (
                            <ShieldStar weight="fill" className="w-3.5 h-3.5" />
                        ) : (
                            <UserCircle weight="fill" className="w-3.5 h-3.5" />
                        )}
                        {isModerator ? 'MOD' : 'ADMIN'}
                    </div>
                )}

                {/* Theme Toggle */}
                <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                >
                    <span className="sr-only">Toggle theme</span>
                    <Sun className="h-6 w-6 hidden dark:block" aria-hidden="true" />
                    <Moon className="h-6 w-6 block dark:hidden" aria-hidden="true" />
                </button>

                {/* Notification Bell + Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="relative p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                    >
                        <span className="sr-only">View notifications</span>
                        <Bell className="h-6 w-6" aria-hidden="true" />
                        {/* Unread badge */}
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-zinc-950">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                        <div className="absolute right-0 mt-2 w-96 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-50 overflow-hidden">
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Thông báo</h3>
                                <div className="flex gap-2">
                                    {badges.pendingKYC > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold">
                                            {badges.pendingKYC} KYC
                                        </span>
                                    )}
                                    {badges.disputedOrders > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold">
                                            {badges.disputedOrders} Dispute
                                        </span>
                                    )}
                                    {badges.newOrders24h > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                                            {badges.newOrders24h} Đơn mới
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Notifications List */}
                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-zinc-400 text-sm">
                                        Không có thông báo nào
                                    </div>
                                ) : (
                                    notifications.map((n) => (
                                        <button
                                            key={n.id}
                                            onClick={() => handleNotificationClick(n)}
                                            className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                                                !n.read ? 'bg-orange-50/50 dark:bg-orange-500/5' : ''
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="text-lg mt-0.5 flex-shrink-0">{getTypeIcon(n.type)}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium line-clamp-1 ${!n.read ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                                        {n.title}
                                                    </p>
                                                    {n.message && (
                                                        <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{n.message}</p>
                                                    )}
                                                    <p className="text-[10px] text-zinc-400 mt-1">{getTimeAgo(n.created_at)}</p>
                                                </div>
                                                {!n.read && (
                                                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                                                )}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between">
                                <Link
                                    href="/kyc"
                                    onClick={() => setIsOpen(false)}
                                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                                >
                                    KYC Sellers →
                                </Link>
                                <Link
                                    href="/marketplace"
                                    onClick={() => setIsOpen(false)}
                                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                                >
                                    Marketplace →
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile / Logout action */}
                <div className="relative">
                    <button
                        onClick={handleSignOut}
                        type="button"
                        className="flex items-center justify-center p-1.5 rounded-full text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                        title="Sign out"
                    >
                        <span className="sr-only">Sign out</span>
                        <SignOut className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </div>
    );
}
