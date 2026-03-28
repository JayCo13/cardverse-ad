"use client";

import { useState, useEffect } from "react";
import { Users, CurrencyDollar, ArrowUpRight, ArrowDownRight, EnvelopeSimple, AppWindow, CircleNotch } from "@phosphor-icons/react";

export default function DashboardOverview() {
  const [data, setData] = useState({
    totalRevenue: 0,
    activeSubscriptions: 0,
    newsletterSubscribers: 0,
    totalScans: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        }
      } catch (e) {
        console.error("Failed to load dashboard stats", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  const stats = [
    {
      name: 'Total Revenue',
      value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(data.totalRevenue),
      change: 'Lifetime',
      changeType: 'positive',
      icon: CurrencyDollar
    },
    {
      name: 'Active Subscriptions',
      value: data.activeSubscriptions.toLocaleString(),
      change: 'Current',
      changeType: 'positive',
      icon: Users
    },
    {
      name: 'Newsletter Subscribers',
      value: data.newsletterSubscribers.toLocaleString(),
      change: 'Lifetime',
      changeType: 'positive',
      icon: EnvelopeSimple
    },
    {
      name: 'New Cards Scanned',
      value: data.totalScans.toLocaleString(),
      change: 'Lifetime',
      changeType: 'positive',
      icon: AppWindow
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Dashboard Overview</h1>
        <div className="flex items-center space-x-2">
          {/* Controls like date pickers go here */}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-sm flex flex-col justify-between transition-colors duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <item.icon className="h-5 w-5 text-orange-500" aria-hidden="true" />
              </div>
              <p className={`ml-2 flex items-baseline text-xs font-semibold text-zinc-500`}>
                {item.change}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{item.name}</p>
              <p className="mt-1 flex items-center text-2xl font-semibold text-zinc-900 dark:text-white">
                {isLoading ? (
                  <CircleNotch className="w-6 h-6 animate-spin text-orange-500 my-1" />
                ) : (
                  item.value
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Tables Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 xl:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-sm transition-colors duration-300">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Revenue Over Time</h2>
          <div className="h-80 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-transparent">
            <p>[Chart Component Developing]</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-2">Will visualize historical transactions</p>
          </div>
        </div>

        <div className="col-span-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-sm transition-colors duration-300">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Recent Activity</h2>
          <div className="h-80 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-transparent">
            <p>[Activity Feed Developing]</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-2">Will stream latest real-time events</p>
          </div>
        </div>
      </div>
    </div>
  );
}
