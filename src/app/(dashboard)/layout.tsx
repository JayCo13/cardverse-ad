"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RoleProvider } from "@/context/RoleContext";
import { AdminNotificationsProvider } from "@/context/AdminNotificationsContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

    return (
        <RoleProvider>
            <AdminNotificationsProvider>
                <div className="flex h-dvh overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                    <Sidebar
                        mobileOpen={mobileNavigationOpen}
                        onMobileClose={() => setMobileNavigationOpen(false)}
                    />

                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {/* Topbar */}
                        <Topbar onOpenNavigation={() => setMobileNavigationOpen(true)} />

                        {/* Main Content Area */}
                        <main className="admin-main flex-1 overflow-auto bg-zinc-50 px-4 py-5 transition-colors duration-300 dark:bg-zinc-950/20 sm:px-6 lg:p-8">
                            <div className="mx-auto min-h-full max-w-7xl">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </AdminNotificationsProvider>
        </RoleProvider>
    );
}
