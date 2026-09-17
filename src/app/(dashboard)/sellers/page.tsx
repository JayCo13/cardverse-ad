"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  CircleNotch,
  Clock,
  MagnifyingGlass,
  UsersThree,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

type SellerStatus = "all" | "pending" | "approved" | "rejected";

type Seller = {
  id: string;
  user_id: string;
  full_name: string;
  status: Exclude<SellerStatus, "all">;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  user: {
    display_name: string | null;
    email: string | null;
    seller_verified: boolean | null;
  } | null;
};

type SellerResponse = {
  sellers: Seller[];
  stats: { total: number; pending: number; approved: number; rejected: number };
  total: number;
  page: number;
  totalPages: number;
};

const EMPTY_DATA: SellerResponse = {
  sellers: [],
  stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
  total: 0,
  page: 1,
  totalPages: 1,
};

const STATUS: Record<Exclude<SellerStatus, "all">, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  approved: { label: "Đã duyệt", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  rejected: { label: "Từ chối", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export default function SellersPage() {
  const [data, setData] = useState<SellerResponse>(EMPTY_DATA);
  const [status, setStatus] = useState<SellerStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSellers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status, search, page: String(page), limit: "20" });
      const response = await fetch(`/api/sellers?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không thể tải danh sách seller");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách seller");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSellers(), 250);
    return () => window.clearTimeout(timer);
  }, [loadSellers]);

  const changeStatus = (nextStatus: SellerStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const cards = [
    { key: "all" as const, label: "Tổng đăng ký", value: data.stats.total, icon: UsersThree, color: "text-orange-500" },
    { key: "pending" as const, label: "Chờ duyệt", value: data.stats.pending, icon: Clock, color: "text-amber-500" },
    { key: "approved" as const, label: "Đã duyệt", value: data.stats.approved, icon: CheckCircle, color: "text-emerald-500" },
    { key: "rejected" as const, label: "Từ chối", value: data.stats.rejected, icon: XCircle, color: "text-red-500" },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">Người bán</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
          <UsersThree className="h-7 w-7 text-orange-500" weight="fill" /> Sellers
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Theo dõi số lượng và danh sách người dùng đã đăng ký bán hàng.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <button key={card.key} type="button" onClick={() => changeStatus(card.key)} className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition dark:bg-zinc-900/60 ${status === card.key ? "border-orange-500 ring-1 ring-orange-500/30" : "border-zinc-200 dark:border-zinc-800"}`}>
            <card.icon className={`h-5 w-5 ${card.color}`} weight="duotone" />
            <p className="mt-4 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{card.value.toLocaleString("vi-VN")}</p>
            <p className="mt-1 text-xs text-zinc-500">{card.label}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-4">
        <label className="relative block max-w-lg">
          <span className="sr-only">Tìm seller</span>
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên, email hoặc user ID..." className="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-3 text-sm text-zinc-900 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300"><div className="flex items-start gap-2"><WarningCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div><button onClick={() => void loadSellers()} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Thử lại</button></div>
      ) : loading && data.sellers.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60"><CircleNotch className="h-7 w-7 animate-spin text-orange-500" /></div>
      ) : data.sellers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800">Không tìm thấy seller phù hợp.</div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-5"><p className="text-sm text-zinc-500"><span className="font-semibold text-zinc-900 dark:text-white">{data.total.toLocaleString("vi-VN")}</span> kết quả</p>{loading && <CircleNotch className="h-4 w-4 animate-spin text-orange-500" />}</div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.sellers.map((seller) => (
              <article key={seller.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(10rem,0.8fr)_auto] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-900 dark:text-white">{seller.user?.display_name || seller.full_name}</p>
                  <p className="mt-0.5 truncate text-sm text-zinc-500">{seller.user?.email || seller.user_id}</p>
                  <p className="mt-1 text-xs text-zinc-400">Tên KYC: {seller.full_name}</p>
                </div>
                <div className="text-xs text-zinc-500"><p>Đăng ký</p><time className="mt-1 block text-sm text-zinc-700 dark:text-zinc-300" dateTime={seller.created_at}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(seller.created_at))}</time></div>
                <div className="sm:text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[seller.status].className}`}>{STATUS[seller.status].label}</span>{seller.status === "approved" && seller.user?.seller_verified === false && <p className="mt-1 text-xs text-red-500">Profile chưa đồng bộ</p>}{seller.status === "rejected" && seller.rejection_reason && <p className="mt-1 max-w-xs text-xs text-zinc-500 sm:ml-auto">{seller.rejection_reason}</p>}</div>
              </article>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-10 rounded-lg border border-zinc-200 px-3 text-sm font-medium disabled:opacity-40 dark:border-zinc-700">Trước</button>
            <span className="text-sm text-zinc-500">Trang {data.page}/{data.totalPages}</span>
            <button type="button" disabled={page >= data.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-lg border border-zinc-200 px-3 text-sm font-medium disabled:opacity-40 dark:border-zinc-700">Sau</button>
          </div>
        </section>
      )}
    </div>
  );
}
