"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bank, CurrencyDollar, EnvelopeSimple, Medal, ShieldCheck, SquaresFour, Storefront, Users, UsersThree, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";

const navigation = [
    { name: "Overview", href: "/", icon: SquaresFour },
    { name: "Users", href: "/users", icon: Users },
    { name: "Sellers", href: "/sellers", icon: UsersThree, badgeKey: "totalSellers" as const },
    { name: "Payments", href: "/payments", icon: CurrencyDollar },
    { name: "Withdrawals", href: "/withdrawals", icon: Bank, badgeKey: "pendingWithdrawals" as const },
    { name: "Subscribers", href: "/subscribers", icon: EnvelopeSimple },
    { name: "Contact requests", href: "/contact-requests", icon: EnvelopeSimple, badgeKey: "openContactRequests" as const },
    { name: "KYC Sellers", href: "/kyc", icon: ShieldCheck, badgeKey: "pendingKYC" as const },
    { name: "Marketplace", href: "/marketplace", icon: Storefront, badgeKey: "disputedOrders" as const },
    { name: "Reputation", href: "/reputation", icon: Medal },
];

type SidebarProps = {
    mobileOpen: boolean;
    onMobileClose: () => void;
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
    const pathname = usePathname();
    const { badges } = useAdminNotifications();

    return (
        <>
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Đóng menu"
                    className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm lg:hidden"
                    onClick={onMobileClose}
                />
            )}
            <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-[min(18rem,86vw)] flex-col border-r border-zinc-200 bg-white shadow-2xl transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800 lg:px-6">
                <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 dark:from-orange-400 dark:to-orange-600 bg-clip-text text-transparent">
                    CardVerseHub Admin
                </span>
                <button type="button" onClick={onMobileClose} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 lg:hidden">
                    <span className="sr-only">Đóng menu</span>
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
                <nav className="flex-1 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
                        const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onMobileClose}
                                className={cn(
                                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                                    isActive
                                        ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500"
                                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                                        isActive ? "text-orange-600 dark:text-orange-500" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                                    )}
                                    weight={isActive ? "fill" : "regular"}
                                    aria-hidden="true"
                                />
                                <span className="flex-1">{item.name}</span>
                                {badgeCount > 0 && (
                                    <span className={cn(
                                        "ml-2 flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold",
                                        item.badgeKey === 'disputedOrders'
                                            ? "bg-red-500 text-white"
                                            : "bg-orange-500 text-white"
                                    )}>
                                        {badgeCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>
            </aside>
        </>
    );
}
