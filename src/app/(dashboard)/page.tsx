"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  Bank,
  CheckCircle,
  CircleNotch,
  CurrencyDollar,
  Package,
  ShieldCheck,
  ShoppingCart,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";

type DashboardData = {
  metrics: {
    totalOrders: number;
    completedOrders: number;
    activeOrders: number;
    completedVolume: number;
    needsAttention: number;
  };
  attention: {
    disputedOrders: number;
    pendingKYC: number;
    pendingWithdrawals: number;
    openContacts: number;
  };
  statusDistribution: Array<{ key: string; label: string; count: number }>;
  recentOrders: Array<{
    id: string;
    status: string;
    amount: number;
    created_at: string;
    card: { name?: string | null } | null;
    buyer: { display_name?: string | null } | null;
    seller: { display_name?: string | null } | null;
  }>;
  generatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn tất",
  disputed: "Khiếu nại",
  refunded: "Đã hoàn tiền",
  cancelled: "Đã hủy",
};

const STATUS_TONES: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  disputed: "bg-red-500/10 text-red-600 dark:text-red-400",
  shipping: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  delivered: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  paid: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

const formatVND = (amount: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
}).format(amount);

export default function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không thể tải dữ liệu tổng quan");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu tổng quan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const stats = useMemo(() => data ? [
    { name: "GMV đã hoàn tất", value: formatVND(data.metrics.completedVolume), hint: "Tổng giá trị đơn hoàn tất", icon: CurrencyDollar },
    { name: "Đơn hoàn tất", value: data.metrics.completedOrders.toLocaleString("vi-VN"), hint: `${data.metrics.totalOrders.toLocaleString("vi-VN")} đơn toàn hệ thống`, icon: CheckCircle },
    { name: "Đơn đang xử lý", value: data.metrics.activeOrders.toLocaleString("vi-VN"), hint: "Đã trả tiền, đang giao hoặc đã giao", icon: ShoppingCart },
    { name: "Cần xử lý", value: data.metrics.needsAttention.toLocaleString("vi-VN"), hint: "Khiếu nại, KYC, rút tiền và liên hệ", icon: Warning },
  ] : [], [data]);

  const maxStatusCount = Math.max(1, ...(data?.statusDistribution.map((item) => item.count) || []));

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">Vận hành marketplace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">Tổng quan</h1>
          <p className="mt-1 text-sm text-zinc-500">Số liệu trực tiếp từ đơn hàng và các hàng đợi cần xử lý.</p>
        </div>
        <button onClick={() => void loadStats()} disabled={isLoading} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto">
          <ArrowsClockwise className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Làm mới
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
          <div className="flex items-start gap-3"><WarningCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Không thể tải số liệu thật</p><p className="mt-1 text-sm">{error}</p></div></div>
          <button onClick={() => void loadStats()} className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Thử lại</button>
        </div>
      ) : isLoading && !data ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50"><CircleNotch className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <article key={item.name} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="mb-5 flex items-start justify-between gap-3"><div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-500"><item.icon className="h-5 w-5" weight="duotone" /></div></div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{item.name}</p>
                <p className="mt-1 break-words text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{item.value}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{item.hint}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-zinc-900 dark:text-white">Trạng thái đơn hàng</h2><p className="mt-1 text-xs text-zinc-500">Toàn bộ dữ liệu hiện tại</p></div><Package className="h-5 w-5 text-zinc-400" /></div>
              <div className="mt-6 space-y-4">
                {data.statusDistribution.map((item) => (
                  <div key={item.key}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="text-zinc-600 dark:text-zinc-300">{item.label}</span><span className="font-semibold tabular-nums text-zinc-900 dark:text-white">{item.count.toLocaleString("vi-VN")}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${item.count === 0 ? 0 : Math.max(4, (item.count / maxStatusCount) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Hàng đợi cần xử lý</h2>
              <div className="mt-4 grid gap-2">
                <AttentionLink href="/marketplace" icon={Warning} label="Khiếu nại" count={data.attention.disputedOrders} />
                <AttentionLink href="/withdrawals" icon={Bank} label="Yêu cầu rút tiền" count={data.attention.pendingWithdrawals} />
                <AttentionLink href="/kyc" icon={ShieldCheck} label="KYC người bán" count={data.attention.pendingKYC} />
                <AttentionLink href="/contact-requests" icon={WarningCircle} label="Yêu cầu liên hệ" count={data.attention.openContacts} />
              </div>
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:px-6"><div><h2 className="font-semibold text-zinc-900 dark:text-white">Đơn hàng gần đây</h2><p className="mt-1 text-xs text-zinc-500">Sắp xếp theo thời điểm tạo</p></div><Link href="/marketplace" className="text-sm font-semibold text-orange-500 hover:text-orange-600">Xem tất cả</Link></div>
            {data.recentOrders.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">Chưa có đơn hàng.</p> : <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.recentOrders.map((order) => (
                <Link href="/marketplace" key={order.id} className="grid gap-2 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6">
                  <div className="min-w-0"><p className="truncate font-medium text-zinc-900 dark:text-white">{order.card?.name || `Đơn #${order.id.slice(0, 8)}`}</p><p className="mt-1 truncate text-xs text-zinc-500">{order.buyer?.display_name || "Người mua"} → {order.seller?.display_name || "Người bán"} · {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.created_at))}</p></div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[order.status] || "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"}`}>{STATUS_LABELS[order.status] || order.status}</span>
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-white sm:text-right">{formatVND(order.amount)}</span>
                </Link>
              ))}
            </div>}
          </section>
          <p className="text-right text-xs text-zinc-400">Cập nhật lúc {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(data.generatedAt))}</p>
        </>
      ) : null}
    </div>
  );
}

function AttentionLink({ href, icon: Icon, label, count }: { href: string; icon: typeof Warning; label: string; count: number }) {
  return <Link href={href} className="flex min-h-12 items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 hover:border-orange-500/40 hover:bg-orange-500/5 dark:border-zinc-800"><Icon className="h-5 w-5 shrink-0 text-orange-500" /><span className="min-w-0 flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${count > 0 ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>{count}</span></Link>;
}
