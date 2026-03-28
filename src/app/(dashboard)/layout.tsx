"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RoleProvider } from "@/context/RoleContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RoleProvider>
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <Sidebar />

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Topbar */}
                    <Topbar />

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-auto p-6 bg-zinc-50 dark:bg-zinc-950/20 transition-colors duration-300">
                        <div className="max-w-7xl mx-auto h-full">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </RoleProvider>
    );
}
