"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { LockKey, CircleNotch } from "@phosphor-icons/react";
import Image from "next/image";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        // Supabase passes the access token in the URL hash fragment on redirect
        // The auth client will automatically parse it and set the session.
        // Once the session is active, we can call updateUser to actually commit the new password.
        supabase.auth.onAuthStateChange(async (event) => {
            if (event == "PASSWORD_RECOVERY") {
                console.log("Password recovery event received");
            }
        });
    }, [supabase]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsLoading(true);

        try {
            // Because we arrived from a recovery link, we should have a temporary active session.
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setSuccess("Password updated successfully! Redirecting...");
            setTimeout(() => {
                router.push("/login");
            }, 2000);

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || "Failed to update password");
            } else {
                setError("Failed to update password");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex items-center justify-center p-4 transition-colors duration-300">
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
                        className="relative w-64 h-16 mb-8"
                    >
                        <Image
                            src="/logo-verse.png"
                            alt="CardVerse Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </motion.div>

                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">Set New Password</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm">Please enter your new administrator password.</p>

                    <form onSubmit={handleUpdatePassword} className="w-full space-y-4">

                        {/* Password Input */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <LockKey weight="bold" className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input
                                type="password"
                                placeholder="New Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full h-12 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                            />
                        </div>

                        {/* Messages */}
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
                            {success && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    className="overflow-hidden"
                                >
                                    <p className="text-sm text-green-400 bg-green-950/30 border border-green-900/50 rounded-lg p-3 text-left">
                                        {success}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isLoading || !!success}
                            type="submit"
                            className="relative w-full h-12 mt-6 overflow-hidden rounded-xl font-bold text-black transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 group-hover:from-orange-300 group-hover:to-orange-400 transition-all" />
                            <div className="relative h-full flex items-center justify-center">
                                {isLoading ? (
                                    <CircleNotch weight="bold" className="w-5 h-5 animate-spin" />
                                ) : (
                                    <span>Update Password</span>
                                )}
                            </div>
                        </motion.button>

                    </form>
                </div>
            </motion.div>
        </div>
    );
}
