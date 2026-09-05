"use client";

import { useState, useEffect, useRef } from "react";
import { Storefront, Package, CheckCircle, CurrencyDollar, ArrowRight } from "@phosphor-icons/react";
import { AlertTriangle, Loader2 } from "lucide-react";

type Order = {
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

/** Public tracking pages, for the carriers the platform has no integration with. */
const CARRIER_TRACKING: Record<string, { name: string; url: string }> = {
    ghn: { name: 'GHN', url: 'https://donhang.ghn.vn/?order_code={code}' },
    vtp: { name: 'Viettel Post', url: 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?peopleTracking={code}' },
    shopee: { name: 'SPX', url: 'https://spx.vn/track?TrackingID={code}' },
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
        hint: 'Xem cả hai video rồi tự quyết — quy tắc không nghiêng về bên nào.',
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
    disputed: { label: 'Khiếu nại', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    refunded: { label: 'Hoàn tiền', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
    cancelled: { label: 'Đã hủy', color: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400' },
};

const FILTER_TABS = ['all', 'paid', 'shipping', 'completed', 'disputed'];

export default function MarketplacePage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, disputed: 0, totalRevenue: 0, totalVolume: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');
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
            const fingerprint = `${orderId}:${action}`;
            actionKeys.current[fingerprint] ||= crypto.randomUUID();
            const res = await fetch('/api/marketplace', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': actionKeys.current[fingerprint],
                },
                body: JSON.stringify({ order_id: orderId, action }),
            });
            if (!res.ok) throw new Error('Failed');
            delete actionKeys.current[fingerprint];
            fetchOrders(activeFilter);
        } catch (err) {
            console.error('Dispute resolution error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

    return (
        <div className="space-y-6">
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
                                                <span className="line-clamp-1 max-w-[120px]">{order.card?.name || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <span>{order.buyer?.display_name || order.buyer?.email || '—'}</span>
                                            <ArrowRight className="inline h-3 w-3 mx-1 text-zinc-400" />
                                            <span>{order.seller?.display_name || order.seller?.email || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 font-semibold">{formatVND(order.amount)}</td>
                                        <td className="px-4 py-3 text-orange-500">{formatVND(order.platform_fee)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-zinc-500">
                                            {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            {order.status === 'disputed' && order.evidence && (() => {
                                                const v = VERDICT_LABELS[order.evidence.verdict];
                                                const rec = order.evidence.recommended_action;
                                                return (
                                                    <div className="mb-2 max-w-[230px] space-y-1">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${v.color}`}>
                                                            {v.label}
                                                        </span>
                                                        <p className="text-[11px] leading-4 text-zinc-500">{v.hint}</p>
                                                        {(() => {
                                                            const link = trackingLink(order.evidence!.shipping_provider, order.evidence!.tracking_number);
                                                            if (!link) return order.evidence!.delivery_state === 'unverified' ? (
                                                                <p className="text-[11px] text-zinc-500">Không có mã vận đơn tra cứu được.</p>
                                                            ) : null;
                                                            return (
                                                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-500 underline">
                                                                    Tra cứu {link.name}: {order.evidence!.tracking_number}
                                                                </a>
                                                            );
                                                        })()}
                                                        <div className="flex gap-2 text-[11px]">
                                                            {order.evidence.seller_video_url && (
                                                                <a href={order.evidence.seller_video_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                                                    Video đóng gói
                                                                </a>
                                                            )}
                                                            {order.evidence.buyer_video_url && (
                                                                <a href={order.evidence.buyer_video_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                                                    Video mở hộp
                                                                </a>
                                                            )}
                                                        </div>
                                                        {rec && (
                                                            <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                                                                Khuyến nghị: {rec === 'refund_buyer' ? 'Hoàn tiền' : 'Release'}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            {order.status === 'disputed' && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleDispute(order.id, 'refund_buyer')}
                                                        disabled={actionLoading === order.id}
                                                        className="px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-xs disabled:opacity-50"
                                                        title="Hoàn tiền cho buyer"
                                                    >
                                                        {actionLoading === order.id ? '...' : 'Hoàn tiền'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDispute(order.id, 'release_seller')}
                                                        disabled={actionLoading === order.id}
                                                        className="px-2 py-1 rounded bg-green-500 hover:bg-green-600 text-white text-xs disabled:opacity-50"
                                                        title="Release tiền cho seller"
                                                    >
                                                        {actionLoading === order.id ? '...' : 'Release'}
                                                    </button>
                                                </div>
                                            )}
                                            {order.dispute_reason && (
                                                <p className="text-xs text-red-400 mt-1 max-w-[150px] truncate" title={order.dispute_reason}>
                                                    {order.dispute_reason}
                                                </p>
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
