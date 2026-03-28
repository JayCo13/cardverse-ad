"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { EnvelopeSimple, LockKey, CircleNotch } from "@phosphor-icons/react";
import Image from "next/image";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // 1. Try Moderator Login via API Route (Environment Variables)
            const modRes = await fetch("/api/auth/moderator/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (modRes.ok) {
                // Moderator authenticated successfully
                router.refresh();
                router.push("/");
                return;
            }

            // 2. Fall back to Supabase Admin Authentication
            const { error: supabaseError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (supabaseError) {
                throw new Error("Invalid admin or moderator credentials.");
            }

            // Supabase authenticated successfully
            router.refresh();
            router.push("/");
        } catch (err: any) {
            setError(err.message || "An error occurred during login.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white dark:bg-black selection:bg-orange-500/30 transition-colors duration-300">

            {/* Background Orbs & Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-orange-600/10 dark:bg-orange-600/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-0 right-0 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-purple-600/5 dark:bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-cyan-600/5 dark:bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 dark:opacity-20 mix-blend-overlay pointer-events-none" />

            {/* Login Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-[420px] p-8 mx-4"
            >
                <div className="absolute inset-0 bg-white dark:bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-zinc-200 dark:border-white/10 shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-colors duration-300" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="relative w-64 h-16 mb-4"
                    >
                        <Image
                            src="/logo-verse.png"
                            alt="CardVerse Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </motion.div>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm">Sign in to manage the CardVerse ecosystem.</p>

                    <form onSubmit={handleLogin} className="w-full space-y-4">

                        {/* Email Input */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <EnvelopeSimple weight="bold" className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input
                                type="email"
                                placeholder="Admin Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full h-12 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                            />
                        </div>

                        {/* Password Input */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <LockKey weight="bold" className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full h-12 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                            />
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    className="overflow-hidden"
                                >
                                    <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-left">
                                        {error}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isLoading}
                            type="submit"
                            className="relative w-full h-12 mt-6 overflow-hidden rounded-xl font-bold text-black transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 group-hover:from-orange-300 group-hover:to-orange-400 transition-all" />
                            <div className="relative h-full flex items-center justify-center">
                                {isLoading ? (
                                    <CircleNotch weight="bold" className="w-5 h-5 animate-spin" />
                                ) : (
                                    <span>Authenticate Session</span>
                                )}
                            </div>
                        </motion.button>

                    </form>

                    <div className="flex justify-end mt-4 w-full">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                router.push("/forgot-password");
                            }}
                            className="text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors bg-transparent border-none cursor-pointer"
                        >
                            Forgot password?
                        </button>
                    </div>

                    <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-white/5 w-full flex justify-center transition-colors">
                        <span className="text-xs text-zinc-500 dark:text-zinc-600 font-mono tracking-widest uppercase">Secure Connection</span>
                    </div>
                </div>
            </motion.div>

        </div>
    );
}
