"use client";

import { useState } from "react";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { EnvelopeSimple, CircleNotch } from "@phosphor-icons/react";
import Image from "next/image";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to send reset link");
            }

            setSuccess("A password reset link has been sent to your email.");

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An error occurred");
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

                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">Recover Password</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm">Enter your administrator email to receive a reset link.</p>

                    <form onSubmit={handleReset} className="w-full space-y-4">

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

                        <div className="flex justify-start mt-2">
                            <Link href="/login" className="text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors">
                                Back to login
                            </Link>
                        </div>

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
                                    <span>Send Reset Link</span>
                                )}
                            </div>
                        </motion.button>

                    </form>
                </div>
            </motion.div>
        </div>
    );
}
