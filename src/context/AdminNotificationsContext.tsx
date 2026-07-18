"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useRole } from "@/context/RoleContext";

export type AdminNotification = {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    link?: string;
};

export type AdminNotificationBadges = {
    pendingKYC: number;
    pendingWithdrawals: number;
    disputedOrders: number;
    newOrders24h: number;
};

type AdminNotificationsContextValue = {
    notifications: AdminNotification[];
    unreadCount: number;
    badges: AdminNotificationBadges;
    refresh: () => Promise<void>;
};

const EMPTY_BADGES: AdminNotificationBadges = {
    pendingKYC: 0,
    pendingWithdrawals: 0,
    disputedOrders: 0,
    newOrders24h: 0,
};

const AdminNotificationsContext = createContext<AdminNotificationsContextValue>({
    notifications: [],
    unreadCount: 0,
    badges: EMPTY_BADGES,
    refresh: async () => {},
});

export function AdminNotificationsProvider({ children }: { children: React.ReactNode }) {
    const { role } = useRole();
    const pathname = usePathname();
    const [supabase] = useState(() => createClient());
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [badges, setBadges] = useState<AdminNotificationBadges>(EMPTY_BADGES);

    const refresh = useCallback(async () => {
        if (!role) return;
        try {
            const response = await fetch('/api/notifications', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Notification request failed (${response.status})`);
            const data = await response.json();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
            setBadges({ ...EMPTY_BADGES, ...(data.badges || {}) });
        } catch (error) {
            console.error('Failed to fetch admin notifications:', error);
        }
    }, [role]);

    useEffect(() => {
        if (!role) return;
        void refresh();

        const interval = window.setInterval(() => void refresh(), 30_000);
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        window.addEventListener('focus', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [pathname, role, refresh]);

    // Supabase-authenticated admins receive immediate KYC inserts/updates.
    // Environment-cookie moderators have no Supabase JWT, so they use the
    // polling/focus fallback above rather than exposing KYC rows publicly.
    useEffect(() => {
        if (role !== 'admin') return;

        const channel = supabase
            .channel('admin-kyc-notifications')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'seller_verifications' },
                () => void refresh(),
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'wallet_withdrawals' },
                () => void refresh(),
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [refresh, role, supabase]);

    return (
        <AdminNotificationsContext.Provider value={{ notifications, unreadCount, badges, refresh }}>
            {children}
        </AdminNotificationsContext.Provider>
    );
}

export function useAdminNotifications() {
    return useContext(AdminNotificationsContext);
}
