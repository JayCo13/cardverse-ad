"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Storefront, Package, CheckCircle, CurrencyDollar, ArrowRight, Eye, X, Truck, SealCheck, Receipt, Scales } from "@phosphor-icons/react";
import { AlertTriangle, Loader2 } from "lucide-react";

type Order = {
    account_holds?: Array<{ created_at: string; event: { reason: string; actor_id: string } }>;
    id: string;
    card_id: string;
    amount: number;
    platform_fee: number;
    total_paid: number;
    payment_method: string;
    status: string;
    tracking_number: string | null;
    dispute_reason: string | null;
    created_at: string;
    /** Present on disputed orders only — computed by dispute_evidence_verdict. */
    evidence: {
        has_buyer_video: boolean;
        has_seller_video: boolean;
        buyer_video_url: string | null;
        seller_video_url: string | null;
        delivery_state: 'delivered' | 'not_delivered' | 'unverified';
        carrier_status: string | null;
        shipping_provider: string | null;
        tracking_number: string | null;
        verdict: 'not_delivered' | 'delivery_unverified' | 'contested'
            | 'seller_missing_evidence' | 'buyer_missing_evidence' | 'no_evidence';
        recommended_action: 'refund_buyer' | 'release_seller' | null;
    } | null;
    card: { id: string; name: string; image_url: string; category: string } | null;
    buyer: { id: string; display_name: string; email: string } | null;
    seller: { id: string; display_name: string; email: string; seller_verified: boolean } | null;
};

type Stats = {
    total: number;
    completed: number;
    disputed: number;
    totalRevenue: number;
    totalVolume: number;
};

/**
 * Public tracking pages, for the carriers the platform has no integration with.
 *
 * Keep in step with `SHIPPING_CARRIERS` in the storefront
 * (`card-verse/src/lib/shipping-carriers.ts`), which carries the same table and
 * the reasoning behind each shape. Two of these are not the obvious form:
 *
 * • SPX reads the WHOLE query string as the tracking number rather than a named
 *   parameter, so `?TrackingID={code}` made it search for the literal text
 *   "TrackingID=SPXVN…" and report no match. The code goes bare after the `?`.
 * • Viettel Post renders its lookup in a reCAPTCHA iframe that receives no query
 *   at all, so no parameter can prefill it. The link is a destination only; the
 *   moderator pastes the number, which is why it stays on screen next to it.
 */
const CARRIER_TRACKING: Record<string, { name: string; url: string }> = {
    ghn: { name: 'GHN', url: 'https://donhang.ghn.vn/?order_code={code}' },
    vtp: { name: 'Viettel Post', url: 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/' },
    shopee: { name: 'SPX', url: 'https://spx.vn/track?{code}' },
    self: { name: 'Tự giao', url: '' },
};

const trackingLink = (provider: string | null, code: string | null): { name: string; url: string } | null => {
    if (!provider || !code) return null;
    const carrier = CARRIER_TRACKING[provider];
    if (!carrier?.url) return null;
    return { name: carrier.name, url: carrier.url.replace('{code}', encodeURIComponent(code)) };
};

/**
 * What the evidence rule says about a dispute. A recommendation, never an
 * automatic payout: a parcel the carrier lost is a real dispute that no
 * unboxing video could ever exist for, and only a person can see that.
 */
const VERDICT_LABELS: Record<string, { label: string; hint: string; color: string }> = {
    not_delivered: {
        label: 'Hãng báo chưa giao',
        hint: 'Người bán chưa chứng minh được hàng đã tới nơi → hoàn tiền. Video không xét ở ca này.',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    },
    delivery_unverified: {
        label: 'Không xác minh được việc giao hàng',
        hint: 'Hãng này chưa tích hợp nên hệ thống không biết hàng đã tới chưa. Mở link tra cứu bên dưới và tự kiểm tra trước khi quyết.',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    },
    contested: {
        label: 'Cả hai đều có video',
        hint: 'Xem cả hai video rồi tự quyết, quy tắc không nghiêng về bên nào.',
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    },
    seller_missing_evidence: {
        label: 'Người bán không có video',
        hint: 'Người mua có video mở hộp, người bán không chứng minh được đã gói gì → hoàn tiền.',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    },
    buyer_missing_evidence: {
        label: 'Người mua không có video',
        hint: 'Người bán có video đóng gói, người mua không chứng minh được đã nhận gì → giải ngân.',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    },
    no_evidence: {
        label: 'Không bên nào có video',
        hint: 'Không có gì để phân xử → giải ngân cho người bán.',
        color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending_payment: { label: 'Chờ TT', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    paid: { label: 'Đã TT', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
    shipping: { label: 'Đang giao', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
    delivered: { label: 'Đã giao', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300' },
    completed: { label: 'Hoàn tất', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    account_review: { label: 'Cần xử lý do khóa tài khoản', color: 'bg-amber-100 text-amber-900' },
    disputed: { label: 'Khiếu nại', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    refunded: { label: 'Hoàn tiền', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
    cancelled: { label: 'Đã hủy', color: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400' },
};

const FILTER_TABS = ['account_review', 'all', 'paid', 'shipping', 'completed', 'disputed'];

export default function MarketplacePage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, disputed: 0, totalRevenue: 0, totalVolume: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');
    const [detail, setDetail] = useState<Order | null>(null);
    const [decision, setDecision] = useState<{ id: string; action: 'refund_buyer' | 'release_seller' } | null>(null);
    const [decisionReason, setDecisionReason] = useState('');
    const [decisionError, setDecisionError] = useState('');
    // Deliberately separate from `action`. Where the money goes and who was at
    // fault usually agree, but not always — a refund for a parcel the carrier
    // lost is nobody's fault, and releasing to the seller after a buyer swapped
    // the card on return is a −20 for that buyer. Defaults to recording nothing,
    // so a verdict is always something a person chose.
    const [verdict, setVerdict] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const actionKeys = useRef<Record<string, string>>({});

    const fetchOrders = async (filter: string) => {
        setIsLoading(true);
        try {
            const url = filter === 'all' ? '/api/marketplace' : `/api/marketplace?status=${filter}`;
            const res = await fetch(url);
            const data = await res.json();
            setOrders(data.orders || []);
            if (data.stats) setStats(data.stats);
        } catch (err) {
            console.error('Failed to fetch:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders(activeFilter);
    }, [activeFilter]);

    const handleDispute = async (orderId: string, action: 'refund_buyer' | 'release_seller') => {
        setActionLoading(orderId);
        try {
            const fingerprint = `${orderId}:${action}:${decisionReason.trim()}`;
            actionKeys.current[fingerprint] ||= crypto.randomUUID();
            const res = await fetch('/api/marketplace', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': actionKeys.current[fingerprint],
                },
                body: JSON.stringify({ order_id: orderId, action, note: decisionReason.trim(), verdict: verdict || null }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Không thể xử lý đơn');
            setDecision(null);
            setDetail(null);
            delete actionKeys.current[fingerprint];
            fetchOrders(activeFilter);
        } catch (err) {
            setDecisionError(err instanceof Error ? err.message : 'Không thể xử lý đơn');
        } finally {
            setActionLoading(null);
        }
    };

    const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

    return (
        <div className="space-y-6">
            <AnimatePresence>
                {detail && <OrderDetail
                    key="detail"
                    order={detail}
                    formatVND={formatVND}
                    onClose={() => setDetail(null)}
                    onDecide={action => { setDecision({ id: detail.id, action }); setDecisionReason(''); setVerdict(''); setDecisionError(''); }}
                />}
            </AnimatePresence>

            {/* Sits above the detail sheet: a decision is taken while reading it. */}
            <AnimatePresence>
                {decision && <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-zinc-900/40 backdrop-blur-sm dark:bg-black/80"
                        onClick={() => !actionLoading && setDecision(null)}
                    />
                    <motion.section
                        role="dialog" aria-modal="true" aria-labelledby="decision-title"
                        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950"
                    >
                        <div className="mb-5 flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${decision.action === 'refund_buyer' ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-green-500/20 bg-green-500/10 text-green-400'}`}>
                                <Scales weight="fill" className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 id="decision-title" className="font-bold text-zinc-900 dark:text-white">{decision.action === 'refund_buyer' ? 'Hoàn tiền người mua' : 'Giải ngân người bán'}</h2>
                                <p className="truncate font-mono text-xs text-zinc-500">{decision.id}</p>
                            </div>
                        </div>
                        <p className="text-sm text-zinc-500">Kiểm tra bằng chứng và nguồn tiền của đơn trước khi xác nhận. Thao tác này không hoàn tác được.</p>
                        <label className="mt-4 block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Lý do quyết định</span>
                            <textarea
                                autoFocus value={decisionReason} onChange={e => setDecisionReason(e.target.value)}
                                disabled={!!actionLoading} maxLength={1000} rows={4}
                                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                            />
                            <span className="mt-1 block text-xs text-zinc-500">{decisionReason.trim().length}/1.000 — tối thiểu 10 ký tự</span>
                        </label>
                        <label className="mt-4 block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Lỗi thuộc về ai</span>
                            <select
                                value={verdict} onChange={e => setVerdict(e.target.value)} disabled={!!actionLoading}
                                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                            >
                                <option value="">Không ghi kết luận</option>
                                <option value="no_fault">Không bên nào có lỗi — 0</option>
                                <option value="seller_wrong_item">Người bán giao sai hàng hoặc sai mô tả — −10</option>
                                <option value="seller_counterfeit">Người bán bán hàng giả hoặc gian lận — −20</option>
                                <option value="buyer_fraud">Người mua gian lận, ví dụ tráo thẻ — −20</option>
                            </select>
                            <span className="mt-1 block text-xs text-zinc-500">Tách riêng với việc tiền đi đâu. Đây là phần làm thay đổi điểm uy tín, và chỉ ghi khi bạn chọn.</span>
                        </label>
                        {decisionError && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{decisionError}</p>}
                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={() => handleDispute(decision.id, decision.action)}
                                disabled={!!actionLoading || decisionReason.trim().length < 10}
                                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${decision.action === 'refund_buyer' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {actionLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Đang xử lý…</> : 'Xác nhận'}
                            </button>
                            <button disabled={!!actionLoading} onClick={() => setDecision(null)} className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5">Đóng</button>
                        </div>
                    </motion.section>
                </>}
            </AnimatePresence>
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Storefront className="h-7 w-7 text-orange-500" weight="fill" />
                    Marketplace
                </h1>
                <p className="text-sm text-zinc-500">Quản lý đơn hàng và doanh thu sàn</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Tổng đơn', value: stats.total, icon: <Package className="h-5 w-5" />, color: 'text-blue-500' },
                    { label: 'Hoàn tất', value: stats.completed, icon: <CheckCircle className="h-5 w-5" />, color: 'text-green-500' },
                    { label: 'Khiếu nại', value: stats.disputed, icon: <AlertTriangle className="h-5 w-5" />, color: 'text-red-500' },
                    { label: 'Phí sàn', value: formatVND(stats.totalRevenue), icon: <CurrencyDollar className="h-5 w-5" />, color: 'text-orange-500' },
                    { label: 'Doanh số', value: formatVND(stats.totalVolume), icon: <CurrencyDollar className="h-5 w-5" />, color: 'text-purple-500' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                        <div className={`${stat.color} mb-2`}>{stat.icon}</div>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                        <p className="text-xs text-zinc-500">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
                {FILTER_TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            activeFilter === tab
                                ? 'bg-orange-500 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        {tab === 'all' ? 'Tất cả' : STATUS_LABELS[tab]?.label || tab}
                    </button>
                ))}
            </div>

            {/* Orders Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : orders.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">Không có đơn hàng nào.</div>
            ) : (
                <div className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left">
                                <th className="px-4 py-3 text-zinc-500 font-medium">Đơn</th>
                                <th className="px-4 py-3 text-zinc-500 font-medium">Thẻ</th>
                                <th className="px-4 py-3 text-zinc-500 font-medium">Người mua → Bán</th>
                                <th className="px-4 py-3 text-zinc-500 font-medium">Số tiền</th>
                                <th className="px-4 py-3 text-zinc-500 font-medium">Phí</th>
                                <th className="px-4 py-3 text-zinc-500 font-medium">Trạng thái</th>
                                <th className="px-4 py-3 text-zinc-500 font-medium">Ngày</th>
                                <th className="px-4 py-3 text-zinc-500 font-medium">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => {
                                const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '' };
                                return (
                                    <tr key={order.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                        <td className="px-4 py-3 font-mono text-xs">#{order.id.substring(0, 8)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {order.card?.image_url && (
                                                    <img src={order.card.image_url} alt="" className="w-8 h-10 rounded object-cover" />
                                                )}
                                                <span className="line-clamp-1 max-w-[120px]">{order.card?.name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <span>{order.buyer?.display_name || order.buyer?.email || '-'}</span>
                                            <ArrowRight className="inline h-3 w-3 mx-1 text-zinc-400" />
                                            <span>{order.seller?.display_name || order.seller?.email || '-'}</span>
                                        </td>
                                        <td className="px-4 py-3 font-semibold">{formatVND(order.amount)}</td>
                                        <td className="px-4 py-3 text-orange-500">{formatVND(order.platform_fee)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-zinc-500">
                                            {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            {/* The evidence, tracking links and dispute reason live in the detail
                                              * sheet. Kept here they widened this column enough to squeeze the
                                              * status pill onto two lines. */}
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <button
                                                    onClick={() => setDetail(order)}
                                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-500 dark:border-white/10 dark:text-zinc-400"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />Chi tiết
                                                </button>
                                                {(order.status === 'disputed' || !!order.account_holds?.length) && (
                                                    <>
                                                        <button
                                                            onClick={() => { setDecision({ id: order.id, action: 'refund_buyer' }); setDecisionReason(''); setVerdict(''); setDecisionError(''); }}
                                                            disabled={actionLoading === order.id}
                                                            className="whitespace-nowrap rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                                                            title="Hoàn tiền cho người mua"
                                                        >
                                                            {actionLoading === order.id ? '…' : 'Hoàn tiền'}
                                                        </button>
                                                        <button
                                                            onClick={() => { setDecision({ id: order.id, action: 'release_seller' }); setDecisionReason(''); setVerdict(''); setDecisionError(''); }}
                                                            disabled={actionLoading === order.id}
                                                            className="whitespace-nowrap rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                                                            title="Giải ngân cho người bán"
                                                        >
                                                            {actionLoading === order.id ? '…' : 'Giải ngân'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            {/* One short marker, so a held order is still spottable while scanning. */}
                                            {!!order.account_holds?.length && (
                                                <p className="mt-1.5 whitespace-nowrap text-[11px] font-medium text-amber-600">Cần xử lý do khóa tài khoản</p>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/** One labelled block inside the detail sheet. */
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <section className="border-t border-zinc-200 pt-5 dark:border-white/5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {icon}{title}
            </h3>
            {children}
        </section>
    );
}

function Party({ role, name, email, verified }: { role: string; name?: string; email?: string; verified?: boolean }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
            <p className="text-xs text-zinc-500">{role}</p>
            <p className="mt-1 flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
                <span className="truncate">{name || email || '—'}</span>
                {verified && <SealCheck weight="fill" className="h-4 w-4 shrink-0 text-blue-500" aria-label="Đã xác minh" />}
            </p>
            {email && name && <p className="truncate text-xs text-zinc-500">{email}</p>}
        </div>
    );
}

/**
 * Everything the API already returns about one order, in a sheet rather than
 * crammed into the actions cell of the table.
 */
function OrderDetail({ order, formatVND, onClose, onDecide }: {
    order: Order;
    formatVND: (amount: number) => string;
    onClose: () => void;
    onDecide: (action: 'refund_buyer' | 'release_seller') => void;
}) {
    const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '' };
    const verdict = order.evidence ? VERDICT_LABELS[order.evidence.verdict] : null;
    const link = trackingLink(order.evidence?.shipping_provider ?? null, order.tracking_number ?? order.evidence?.tracking_number ?? null);
    const actionable = order.status === 'disputed' || !!order.account_holds?.length;

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm dark:bg-black/80"
                onClick={onClose}
            />
            <motion.section
                role="dialog" aria-modal="true" aria-labelledby="order-detail-title"
                initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950"
            >
                <div className="absolute right-0 top-0 h-[300px] w-[300px] -translate-y-1/2 translate-x-1/3 rounded-full bg-orange-500/10 blur-[80px]" />

                <header className="relative flex items-start justify-between gap-4 border-b border-zinc-200 p-6 dark:border-white/5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
                            <Receipt weight="fill" className="h-5 w-5 text-orange-400" />
                        </div>
                        <div className="min-w-0">
                            <h2 id="order-detail-title" className="text-lg font-bold text-zinc-900 dark:text-white">Chi tiết đơn hàng</h2>
                            <p className="truncate font-mono text-xs text-zinc-500">{order.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Đóng" className="rounded-full bg-zinc-100/50 p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="relative space-y-5 overflow-y-auto p-6">
                    <div className="flex gap-4">
                        {order.card?.image_url
                            ? <img src={order.card.image_url} alt="" className="h-24 w-[68px] shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-white/10" />
                            : <div className="flex h-24 w-[68px] shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-white/10"><Package className="h-5 w-5 text-zinc-500" /></div>}
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-900 dark:text-white">{order.card?.name || 'Thẻ đã bị gỡ'}</p>
                            {order.card?.category && <p className="text-xs text-zinc-500">{order.card.category}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                                <span className="text-xs text-zinc-500">{new Date(order.created_at).toLocaleString('vi-VN')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Party role="Người mua" name={order.buyer?.display_name} email={order.buyer?.email} />
                        <Party role="Người bán" name={order.seller?.display_name} email={order.seller?.email} verified={order.seller?.seller_verified} />
                    </div>

                    <Section icon={<CurrencyDollar className="h-4 w-4" />} title="Thanh toán">
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Số tiền', value: formatVND(order.amount), cls: 'text-zinc-900 dark:text-white' },
                                { label: 'Phí sàn', value: formatVND(order.platform_fee), cls: 'text-orange-500' },
                                { label: 'Tổng trả', value: formatVND(order.total_paid), cls: 'text-zinc-900 dark:text-white' },
                            ].map(m => (
                                <div key={m.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                                    <p className="text-xs text-zinc-500">{m.label}</p>
                                    <p className={`mt-0.5 font-semibold ${m.cls}`}>{m.value}</p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">Phương thức: {order.payment_method || '—'}</p>
                    </Section>

                    <Section icon={<Truck className="h-4 w-4" />} title="Vận chuyển">
                        {order.tracking_number ? (
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                <span className="font-mono">{order.tracking_number}</span>
                                {link && <> — <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Tra cứu {link.name}</a></>}
                            </p>
                        ) : <p className="text-sm text-zinc-500">Chưa có mã vận đơn.</p>}
                        {order.evidence?.carrier_status && <p className="mt-1 text-xs text-zinc-500">Hãng báo: {order.evidence.carrier_status}</p>}
                    </Section>

                    {order.dispute_reason && (
                        <Section icon={<AlertTriangle className="h-4 w-4" />} title="Lý do khiếu nại">
                            <p className="whitespace-pre-wrap break-words rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-zinc-700 dark:text-zinc-200">{order.dispute_reason}</p>
                        </Section>
                    )}

                    {verdict && order.evidence && (
                        <Section icon={<Scales className="h-4 w-4" />} title="Bằng chứng">
                            <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${verdict.color}`}>{verdict.label}</span>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{verdict.hint}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-sm">
                                {order.evidence.seller_video_url && <a href={order.evidence.seller_video_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Video đóng gói</a>}
                                {order.evidence.buyer_video_url && <a href={order.evidence.buyer_video_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Video mở hộp</a>}
                                {!order.evidence.seller_video_url && !order.evidence.buyer_video_url && <span className="text-zinc-500">Không bên nào nộp video.</span>}
                            </div>
                            {order.evidence.recommended_action && (
                                <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                                    Khuyến nghị: {order.evidence.recommended_action === 'refund_buyer' ? 'Hoàn tiền người mua' : 'Giải ngân người bán'}
                                </p>
                            )}
                        </Section>
                    )}

                    {!!order.account_holds?.length && (
                        <Section icon={<AlertTriangle className="h-4 w-4" />} title="Giữ do khóa tài khoản">
                            {order.account_holds.map((hold, i) => (
                                <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                    <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{hold.event?.reason}</p>
                                    <p className="mt-1 text-xs text-zinc-500">{new Date(hold.created_at).toLocaleString('vi-VN')}</p>
                                </div>
                            ))}
                        </Section>
                    )}
                </div>

                {actionable && (
                    <footer className="relative flex gap-3 border-t border-zinc-200 p-6 dark:border-white/5">
                        <button onClick={() => onDecide('refund_buyer')} className="h-10 flex-1 rounded-xl bg-red-500 text-sm font-semibold text-white transition-colors hover:bg-red-600">Hoàn tiền người mua</button>
                        <button onClick={() => onDecide('release_seller')} className="h-10 flex-1 rounded-xl bg-green-600 text-sm font-semibold text-white transition-colors hover:bg-green-700">Giải ngân người bán</button>
                    </footer>
                )}
            </motion.section>
        </>
    );
}
