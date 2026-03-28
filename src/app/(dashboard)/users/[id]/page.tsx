"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, User as UserIcon, EnvelopeSimple, Clock,
    ShieldCheck, Crown, Scan, CheckCircle, WarningCircle,
    CircleNotch, Key, Gift, Timer, CreditCard, X
} from "@phosphor-icons/react";

interface UserDetailsProps {
    params: Promise<{ id: string }>;
}

interface UserData {
    authInfo: {
        id: string;
        email: string;
        created_at: string;
        last_sign_in_at?: string;
    };
    profile: {
        display_name: string | null;
        avatar_url: string | null;
        legit_rate: number;
        total_transactions: number;
    } | null;
    subscriptions: Array<{
        id: string;
        package_type: string;
        status: string;
        starts_at: string;
        expires_at: string | null;
        scan_credits_remaining: number | null;
    }>;
    scanStats: {
        total: number;
        today: number;
        thisMonth: number;
        thisYear: number;
        lastResetDate: string | null;
    } | null;
}

export default function UserDetailsPage({ params }: UserDetailsProps) {
    const router = useRouter();
    const resolvedParams = use(params);
    const userId = resolvedParams.id;

    const [data, setData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Giveaway modal state
    const [showGiveaway, setShowGiveaway] = useState(false);
    const [giveawayLoading, setGiveawayLoading] = useState<string | null>(null);
    const [giveawayResult, setGiveawayResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchUserDetails = async () => {
        try {
            const res = await fetch(`/api/users/${userId}/details`);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || "Failed to load user details");
            }

            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUserDetails();
    }, [userId]);

    const handleGiveaway = async (packageType: string) => {
        setGiveawayLoading(packageType);
        setGiveawayResult(null);
        try {
            const res = await fetch(`/api/users/${userId}/giveaway`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageType }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to grant package');

            const label = packageType.replace('_', ' ').toUpperCase();
            setGiveawayResult({ type: 'success', message: `${label} granted successfully!` });
            // Refresh user data to show the new subscription
            fetchUserDetails();
        } catch (err: any) {
            setGiveawayResult({ type: 'error', message: err.message });
        } finally {
            setGiveawayLoading(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <CircleNotch className="w-12 h-12 text-orange-500 animate-spin" />
                <p className="text-zinc-400 font-medium">Loading user data...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <WarningCircle className="w-16 h-16 text-red-500/50" />
                <h2 className="text-xl font-medium text-white">Error Loading User</h2>
                <p className="text-zinc-500">{error || "Unknown error occurred"}</p>
                <button
                    onClick={() => router.push('/users')}
                    className="mt-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Users
                </button>
            </div>
        );
    }

    const { authInfo, profile, subscriptions, scanStats } = data;

    return (
        <div className="space-y-6 pb-12">
            {/* Header Actions */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push('/users')}
                    className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-200 dark:border-white/5"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">User Details</h1>

                <div className="flex-1" />
                <button
                    onClick={() => { setShowGiveaway(true); setGiveawayResult(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Gift className="w-4 h-4" weight="fill" />
                    Give Package
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Header Banner: Identity Profile (Spans 3 cols) */}
                <div className="col-span-1 lg:col-span-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl flex flex-col md:flex-row items-center gap-6 group shadow-sm transition-colors">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-orange-500/20 transition-colors pointer-events-none" />

                    {/* avatar */}
                    <div className="w-24 h-24 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-950 shadow-xl overflow-hidden flex items-center justify-center relative z-10 transition-colors">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
                        )}
                    </div>

                    {/* name & email */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left relative z-10">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 transition-colors">
                            {profile?.display_name || "Unnamed User"}
                        </h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            <p className="text-zinc-500 dark:text-zinc-400 font-mono text-sm transition-colors">{authInfo.email}</p>
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Active Account</span>
                            </div>
                        </div>
                    </div>

                    {/* Spacer */}
                    <div className="hidden md:block flex-1"></div>

                    {/* Right side stats */}
                    <div className="flex flex-row gap-8 items-center mt-6 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-zinc-200 dark:border-white/5 relative z-10 w-full md:w-auto justify-around md:justify-end transition-colors">
                        <div className="flex flex-col items-center md:items-end">
                            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Joined
                            </span>
                            <span className="text-zinc-900 dark:text-white font-medium transition-colors">{new Date(authInfo.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex flex-col items-center md:items-end">
                            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5" /> User ID
                            </span>
                            <span className="text-zinc-900 dark:text-white font-mono text-sm transition-colors">{authInfo.id.split('-')[0]}...</span>
                        </div>
                    </div>
                </div>

                {/* Column 1: Account Overview */}
                <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 flex flex-col h-full backdrop-blur-xl shadow-sm transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-50/50 dark:bg-blue-500/10 flex items-center justify-center border border-blue-200 dark:border-blue-500/20 transition-colors">
                            <UserIcon weight="fill" className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                        </div>
                        <h3 className="text-zinc-700 dark:text-zinc-400 font-medium transition-colors">Account Overview</h3>
                    </div>

                    <div className="flex flex-col gap-4 flex-1">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex items-center justify-between group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Last Sign In</span>
                            <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right text-sm transition-colors">
                                {authInfo.last_sign_in_at ? new Date(authInfo.last_sign_in_at).toLocaleString() : 'Never'}
                            </span>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex items-center justify-between group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Total Packages</span>
                            <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right text-sm transition-colors">
                                {subscriptions.length} <span className="text-zinc-400 dark:text-zinc-500">active/past</span>
                            </span>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex items-center justify-between group hover:border-zinc-300 dark:hover:border-white/10 transition-colors h-full">
                            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Avg. Trust Rate</span>
                            <span className="text-green-600 dark:text-green-400 font-bold text-xl text-right transition-colors">
                                {profile?.legit_rate || 100}%
                            </span>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex items-center justify-between group hover:border-zinc-300 dark:hover:border-white/10 transition-colors h-full">
                            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Completed Txs</span>
                            <span className="text-zinc-900 dark:text-zinc-200 font-bold text-xl text-right transition-colors">
                                {profile?.total_transactions || 0}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Column 2: Subscription History */}
                <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 flex flex-col h-full backdrop-blur-xl shadow-sm transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-50/50 dark:bg-purple-500/10 flex items-center justify-center border border-purple-200 dark:border-purple-500/20 transition-colors">
                            <Crown weight="fill" className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                        </div>
                        <h3 className="text-zinc-700 dark:text-zinc-400 font-medium transition-colors">Subscription History</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {subscriptions.length > 0 ? subscriptions.map((sub) => (
                            <div key={sub.id} className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 relative group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                                <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    <div className={`w-2 h-2 rounded-full ${sub.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                                    {sub.status}
                                </div>

                                <div className="text-base font-bold text-zinc-900 dark:text-white mb-3 transition-colors">
                                    {sub.package_type.replace('_', ' ').toUpperCase()}
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400 mb-3 transition-colors">
                                    <div>
                                        <span className="block text-zinc-500 dark:text-zinc-600 font-semibold uppercase tracking-wider text-[10px] mb-1">Start Date</span>
                                        <span className="text-zinc-800 dark:text-zinc-300 font-medium transition-colors">{new Date(sub.starts_at).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="block text-zinc-500 dark:text-zinc-600 font-semibold uppercase tracking-wider text-[10px] mb-1">End Date</span>
                                        <span className="text-zinc-800 dark:text-zinc-300 font-medium transition-colors">
                                            {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Lifetime'}
                                        </span>
                                    </div>
                                </div>

                                {sub.package_type === 'credit_pack' && (
                                    <div className="pt-3 border-t border-zinc-200 dark:border-white/5 flex items-center justify-between transition-colors">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Credits Remaining</span>
                                        <span className="text-sm font-bold text-zinc-900 dark:text-white px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-md border border-zinc-300 dark:border-white/5 transition-colors">{sub.scan_credits_remaining ?? 0}</span>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="flex items-center justify-center h-full min-h-[120px] text-zinc-500 text-sm border border-dashed border-zinc-300 dark:border-white/10 rounded-xl transition-colors">
                                No subscription history
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 3: Scan Analytics */}
                <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 flex flex-col h-[500px] lg:h-auto backdrop-blur-xl shadow-sm transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-orange-50/50 dark:bg-orange-500/10 flex items-center justify-center border border-orange-200 dark:border-orange-500/20 transition-colors">
                            <Scan weight="bold" className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                        </div>
                        <h3 className="text-zinc-700 dark:text-zinc-400 font-medium transition-colors">Scan Analytics</h3>
                    </div>

                    <div className="flex flex-col gap-4 flex-1">
                        <div className="p-5 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex items-center justify-between group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                            <div className="flex flex-col">
                                <span className="text-zinc-500 text-[10px] font-bold tracking-wider uppercase mb-1">Lifetime Scans</span>
                            </div>
                            <span className="text-3xl font-bold text-zinc-900 dark:text-white transition-colors">{scanStats?.total || 0}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex flex-col group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                                <span className="text-zinc-500 text-[10px] font-bold tracking-wider uppercase mb-1">Today</span>
                                <span className="text-2xl font-bold text-zinc-900 dark:text-white transition-colors">{scanStats?.today || 0}</span>
                                {scanStats?.lastResetDate && (
                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-600 mt-2 font-medium transition-colors">
                                        RESET: {new Date(scanStats.lastResetDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>

                            <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex flex-col group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
                                <span className="text-zinc-500 text-[10px] font-bold tracking-wider uppercase mb-1">This Month</span>
                                <span className="text-2xl font-bold text-zinc-900 dark:text-white transition-colors">{scanStats?.thisMonth || 0}</span>
                            </div>
                        </div>

                        <div className="p-5 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200 dark:border-white/5 flex flex-col relative overflow-hidden group flex-1 justify-center hover:border-zinc-300 dark:hover:border-white/10 transition-colors cursor-default">
                            {/* decorative gradient */}
                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-orange-500/10 to-transparent z-0 opacity-50 group-hover:opacity-100 transition-opacity" />

                            <span className="text-orange-600 dark:text-orange-500/80 text-[10px] font-bold tracking-wider uppercase mb-2 relative z-10 transition-colors">This Year</span>
                            <div className="flex items-end justify-between relative z-10">
                                <span className="text-4xl font-bold text-zinc-900 dark:text-white transition-colors">{scanStats?.thisYear || 0}</span>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-500/20 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"></span>
                                    ACTIVE
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Giveaway Modal */}
            {showGiveaway && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowGiveaway(false)}>
                    <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl transition-colors" onClick={(e) => e.stopPropagation()}>
                        {/* Close Button */}
                        <button
                            onClick={() => setShowGiveaway(false)}
                            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-orange-50 dark:bg-gradient-to-br dark:from-orange-500/20 dark:to-amber-500/20 border border-orange-200 dark:border-orange-500/30 flex items-center justify-center transition-colors">
                                <Gift className="w-7 h-7 text-orange-500 dark:text-orange-400" weight="fill" />
                            </div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white transition-colors">Give Scan Package</h2>
                            <p className="text-zinc-500 text-sm mt-1">Grant a package to <span className="text-zinc-800 dark:text-zinc-300 font-medium transition-colors">{authInfo.email}</span></p>
                        </div>

                        {/* Feedback */}
                        {giveawayResult && (
                            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${giveawayResult.type === 'success'
                                ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
                                : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
                                }`}>
                                {giveawayResult.type === 'success' ? <CheckCircle className="w-4 h-4" weight="fill" /> : <WarningCircle className="w-4 h-4" weight="fill" />}
                                {giveawayResult.message}
                            </div>
                        )}

                        {/* Package Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Day Pass */}
                            <div className="p-5 bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-white/5 rounded-xl hover:border-blue-400 dark:hover:border-blue-500/30 transition-colors group">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center border border-blue-200 dark:border-blue-500/20 mb-3 transition-colors">
                                    <Timer className="w-5 h-5 text-blue-600 dark:text-blue-400" weight="bold" />
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-1 transition-colors">Day Pass</h3>
                                <p className="text-zinc-500 text-xs mb-1">24 hours unlimited</p>
                                <p className="text-zinc-400 dark:text-zinc-600 text-[10px] mb-4 transition-colors">Up to 500 scans</p>
                                <button
                                    onClick={() => handleGiveaway('day_pass')}
                                    disabled={!!giveawayLoading}
                                    className="w-full py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {giveawayLoading === 'day_pass' ? <CircleNotch className="w-4 h-4 animate-spin mx-auto" /> : 'Grant'}
                                </button>
                            </div>

                            {/* Credit Pack */}
                            <div className="p-5 bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-white/5 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-500/30 transition-colors group">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20 mb-3 transition-colors">
                                    <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" weight="bold" />
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-1 transition-colors">Credit Pack</h3>
                                <p className="text-zinc-500 text-xs mb-1">100 scan credits</p>
                                <p className="text-zinc-400 dark:text-zinc-600 text-[10px] mb-4 transition-colors">Never expires</p>
                                <button
                                    onClick={() => handleGiveaway('credit_pack')}
                                    disabled={!!giveawayLoading}
                                    className="w-full py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {giveawayLoading === 'credit_pack' ? <CircleNotch className="w-4 h-4 animate-spin mx-auto" /> : 'Grant'}
                                </button>
                            </div>

                            {/* VIP Pro */}
                            <div className="p-5 bg-zinc-50 dark:bg-zinc-950/80 border border-orange-200 dark:border-orange-500/10 rounded-xl hover:border-orange-400 dark:hover:border-orange-500/30 transition-colors group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 dark:bg-orange-500/5 blur-[30px] rounded-full pointer-events-none transition-colors" />
                                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-gradient-to-br dark:from-orange-500/20 dark:to-amber-500/20 flex items-center justify-center border border-orange-200 dark:border-orange-500/20 mb-3 relative z-10 transition-colors">
                                    <Crown className="w-5 h-5 text-orange-600 dark:text-orange-400" weight="fill" />
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-1 relative z-10 transition-colors">VIP Pro</h3>
                                <p className="text-zinc-500 text-xs mb-1 relative z-10">30 days unlimited</p>
                                <p className="text-zinc-400 dark:text-zinc-600 text-[10px] mb-4 relative z-10 transition-colors">Up to 3,000 scans</p>
                                <button
                                    onClick={() => handleGiveaway('vip_pro')}
                                    disabled={!!giveawayLoading}
                                    className="w-full py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 dark:hover:from-orange-400 dark:hover:to-amber-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors relative z-10"
                                >
                                    {giveawayLoading === 'vip_pro' ? <CircleNotch className="w-4 h-4 animate-spin mx-auto" /> : 'Grant'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
