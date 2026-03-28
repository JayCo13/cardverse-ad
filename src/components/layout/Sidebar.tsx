"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
    SquaresFour,
    Users,
    CurrencyDollar,
    Cards,
    EnvelopeSimple,
    Gear,
    ShieldCheck,
    Storefront
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Overview", href: "/", icon: SquaresFour },
    { name: "Users", href: "/users", icon: Users },
    { name: "Payments", href: "/payments", icon: CurrencyDollar },
    { name: "Subscribers", href: "/subscribers", icon: EnvelopeSimple },
    { name: "KYC Sellers", href: "/kyc", icon: ShieldCheck, badgeKey: "pendingKYC" as const },
    { name: "Marketplace", href: "/marketplace", icon: Storefront, badgeKey: "disputedOrders" as const },
];

type BadgeKeys = "pendingKYC" | "disputedOrders";

export function Sidebar() {
    const pathname = usePathname();
    const [badges, setBadges] = useState<Record<BadgeKeys, number>>({ pendingKYC: 0, disputedOrders: 0 });

    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const res = await fetch('/api/notifications');
                const data = await res.json();
                if (data.badges) {
                    setBadges({
                        pendingKYC: data.badges.pendingKYC || 0,
                        disputedOrders: data.badges.disputedOrders || 0,
                    });
                }
            } catch {} // silently fail
        };
        fetchBadges();
        const interval = setInterval(fetchBadges, 30_000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-full w-64 flex-col bg-white border-r border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 transition-colors duration-300">
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 dark:from-orange-400 dark:to-orange-600 bg-clip-text text-transparent">
                    CardVerse Admin
                </span>
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
        </div>
    );
}
