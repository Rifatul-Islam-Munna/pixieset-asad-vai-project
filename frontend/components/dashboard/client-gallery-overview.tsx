"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Eye,
  Images,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
  Upload,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { GetRequestNormal } from "@/api-hooks/api-hooks";
import type { BillingUser } from "@/actions/billing";

export type GalleryDashboardOverview = {
  user: { name: string; storageUsedBytes: number; storageLimitGb: number };
  metrics: {
    revenue: number;
    revenueChange: number;
    orders: number;
    ordersChange: number;
    views: number;
    viewsChange: number;
    conversionRate: number;
    conversionChange: number;
  };
  recentGalleries: Array<{
    _id: string;
    name: string;
    slug?: string;
    coverImage?: string;
    imageCount: number;
    status: string;
    views: number;
    sales: number;
    updatedAt?: string;
  }>;
  activity: Array<{
    type: string;
    title: string;
    detail: string;
    createdAt?: string;
  }>;
  series: Array<{
    date: string;
    views: number;
    orders: number;
    revenue: number;
  }>;
  topGalleries: Array<{
    _id: string;
    name: string;
    coverImage?: string;
    views: number;
  }>;
};

const money = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US");

export function ClientGalleryOverview({
  billingUser,
}: {
  billingUser: BillingUser | null;
}) {
  const query = useQuery({
    queryKey: ["client-gallery-dashboard-overview"],
    queryFn: () =>
      GetRequestNormal<{ data: GalleryDashboardOverview }>(
        "/collections/dashboard-overview",
      ),
    refetchInterval: 60_000,
  });
  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError || !query.data?.data)
    return (
      <div className="rounded-2xl border bg-white p-8 text-center">
        <p className="font-semibold">Dashboard data could not be loaded.</p>
        <button
          className="mt-4 rounded-lg bg-[#6337d8] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => query.refetch()}
        >
          Try again
        </button>
      </div>
    );
  const data = query.data.data;
  const displayName = data.user.name || billingUser?.name || "there";
  const storageLimit =
    data.user.storageLimitGb || Number(billingUser?.storageLimitGb || 0);
  const storageUsedBytes =
    data.user.storageUsedBytes || Number(billingUser?.storageUsedBytes || 0);
  const storageUsedGb = storageUsedBytes / 1024 / 1024 / 1024;
  const storagePercent =
    storageLimit > 0 ? Math.min(100, (storageUsedGb / storageLimit) * 100) : 0;
  const recentSeries = data.series.slice(-8);
  const cards = [
    {
      label: "Total Revenue",
      value: money.format(data.metrics.revenue),
      change: data.metrics.revenueChange,
      bars: recentSeries.map((item) => item.revenue),
    },
    {
      label: "Orders",
      value: number.format(data.metrics.orders),
      change: data.metrics.ordersChange,
      bars: recentSeries.map((item) => item.orders),
    },
    {
      label: "Views",
      value: number.format(data.metrics.views),
      change: data.metrics.viewsChange,
      bars: recentSeries.map((item) => item.views),
    },
    {
      label: "Conversion Rate",
      value: `${data.metrics.conversionRate.toFixed(1)}%`,
      change: data.metrics.conversionChange,
      bars: recentSeries.map((item) =>
        item.views > 0 ? (item.orders / item.views) * 100 : 0,
      ),
    },
  ];
  return (
    <div className="w-full pb-12">
      <header className="flex flex-col gap-5 border-b border-[#efedf5] bg-white px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-.03em] text-[#18171d]">
            Good morning, {displayName} 👋
          </h1>
          <p className="mt-1 text-sm text-[#77727f]">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/client-gallery/collection-new"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#6337d8] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(99,55,216,.22)]"
          >
            <Plus className="size-4" /> New Gallery
          </Link>
        </div>
      </header>
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </section>
        <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="overflow-hidden rounded-2xl border border-[#eceaf1] bg-white shadow-[0_10px_32px_rgba(35,25,70,.04)]">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-bold">Recent Galleries</h2>
              <Link
                href="/dashboard/client-gallery"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6337d8]"
              >
                View all galleries <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-[#fbfafc] text-[11px] uppercase tracking-[.12em] text-[#8c8794]">
                  <tr>
                    <th className="px-5 py-3">Gallery</th>
                    <th className="px-4 py-3">Photos</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Sales</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efedf3]">
                  {data.recentGalleries.length ? (
                    data.recentGalleries.map((gallery) => (
                      <tr key={gallery._id} className="hover:bg-[#fcfbff]">
                        <td className="px-5 py-3">
                          <Link
                            href={`/dashboard/client-gallery/collections/${gallery._id}`}
                            className="flex items-center gap-3"
                          >
                            <GalleryThumb src={gallery.coverImage} />
                            <span className="font-semibold text-[#25232a]">
                              {gallery.name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[#6f6978]">
                          {number.format(gallery.imageCount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${gallery.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}
                          >
                            {gallery.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {number.format(gallery.views)}
                        </td>
                        <td className="px-4 py-3">
                          {money.format(gallery.sales)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#77727f]">
                          {timeAgo(gallery.updatedAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-[#77727f]"
                      >
                        No galleries yet. Create your first gallery to start
                        seeing data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl border border-[#eceaf1] bg-white shadow-[0_10px_32px_rgba(35,25,70,.04)]">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-bold">Recent Activity</h2>
            </div>
            <div className="divide-y divide-[#f0eef4]">
              {data.activity.length ? (
                data.activity.map((item, i) => (
                  <div
                    key={`${item.type}-${i}`}
                    className="flex gap-3 px-5 py-4"
                  >
                    <ActivityIcon type={item.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 truncate text-xs text-[#77727f]">
                        {item.detail}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-[#9a95a1]">
                      {timeAgo(item.createdAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-5 py-10 text-center text-sm text-[#77727f]">
                  No recent activity.
                </p>
              )}
            </div>
          </div>
        </section>
        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-2xl border border-[#eceaf1] bg-white p-5 shadow-[0_10px_32px_rgba(35,25,70,.04)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Analytics Overview</h2>
                <p className="mt-1 text-xs text-[#8c8794]">
                  Live gallery views from the last 14 days
                </p>
              </div>
            </div>
            <div className="mt-5 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series}>
                  <defs>
                    <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6337d8" stopOpacity={0.3} />
                      <stop
                        offset="100%"
                        stopColor="#6337d8"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eeeaf4"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    tick={{ fontSize: 11, fill: "#8c8794" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#8c8794" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#6337d8"
                    strokeWidth={2}
                    fill="url(#viewsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-5">
            <div className="rounded-2xl border border-[#eceaf1] bg-white p-5 shadow-[0_10px_32px_rgba(35,25,70,.04)]">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Storage</h2>
                <Link
                  href="/dashboard/client-gallery/storage"
                  className="text-xs font-semibold text-[#6337d8]"
                >
                  View details
                </Link>
              </div>
              <p className="mt-5 text-sm font-semibold">
                {storageUsedGb.toFixed(2)} GB of {storageLimit.toFixed(0)} GB
                used
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ece9f3]">
                <div
                  className="h-full rounded-full bg-[#6337d8]"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs text-[#8c8794]">
                {storagePercent.toFixed(0)}%
              </p>
            </div>
            <QuickActions />
          </div>
        </section>
        <section className="mt-5 rounded-2xl border border-[#eceaf1] bg-white p-5 shadow-[0_10px_32px_rgba(35,25,70,.04)]">
          <h2 className="font-bold">Top Galleries</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {data.topGalleries.map((gallery, index) => (
              <Link
                key={gallery._id}
                href={`/dashboard/client-gallery/collections/${gallery._id}`}
                className="flex items-center gap-3 rounded-xl border border-[#efedf3] p-3 hover:border-[#cabdf0]"
              >
                <span className="text-xs font-bold text-[#8c8794]">
                  {index + 1}
                </span>
                <GalleryThumb src={gallery.coverImage} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {gallery.name}
                  </p>
                  <p className="mt-1 text-xs text-[#8c8794]">
                    {number.format(gallery.views)} views
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  bars,
}: {
  label: string;
  value: string;
  change: number;
  bars: number[];
}) {
  const maximum = Math.max(1, ...bars);
  const normalizedBars = bars.length ? bars : [0, 0, 0, 0, 0, 0, 0, 0];

  return (
    <div className="rounded-2xl border border-[#eceaf1] bg-white p-5 shadow-[0_10px_30px_rgba(35,25,70,.04)]">
      <div className="flex items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#77727f]">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-.03em]">{value}</p>
        </div>
        <div className="flex h-12 w-24 shrink-0 items-end justify-end gap-1" aria-hidden="true">
          {normalizedBars.map((bar, index) => (
            <span
              key={index}
              className="min-h-[4px] flex-1 rounded-t-sm bg-[#6337d8]/80"
              style={{ height: `${Math.max(8, (bar / maximum) * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <p
        className={`mt-4 text-xs font-semibold ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}
      >
        {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%{" "}
        <span className="font-normal text-[#9a95a1]">vs previous 30 days</span>
      </p>
    </div>
  );
}
function GalleryThumb({ src }: { src?: string }) {
  return src ? (
    <img src={src} alt="" className="h-11 w-16 rounded-lg object-cover" />
  ) : (
    <span className="grid h-11 w-16 place-items-center rounded-lg bg-[#f2eff7] text-[#8c8794]">
      <Images className="size-5" />
    </span>
  );
}
function ActivityIcon({ type }: { type: string }) {
  const Icon =
    type === "payment"
      ? WalletCards
      : type === "order"
        ? ShoppingBag
        : type === "download"
          ? Upload
          : UserPlus;
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f2edff] text-[#6337d8]">
      <Icon className="size-4" />
    </span>
  );
}
function QuickActions() {
  const items = [
    { label: "Upload Photos", href: "/dashboard/client-gallery", icon: Upload },
    {
      label: "Create Gallery",
      href: "/dashboard/client-gallery/collection-new",
      icon: Images,
    },
    {
      label: "View Orders",
      href: "/dashboard/store-gallery/orders",
      icon: Package,
    },
    {
      label: "Marketing Contacts",
      href: "/dashboard/client-gallery/marketing/contacts",
      icon: UserPlus,
    },
  ];
  return (
    <div className="rounded-2xl border border-[#eceaf1] bg-white p-5 shadow-[0_10px_32px_rgba(35,25,70,.04)]">
      <h2 className="font-bold">Quick Actions</h2>
      <div className="mt-3 divide-y divide-[#f0eef4]">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 py-3 text-sm font-medium hover:text-[#6337d8]"
          >
            <item.icon className="size-4 text-[#6337d8]" />
            <span className="flex-1">{item.label}</span>
            <ArrowRight className="size-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}
function timeAgo(value?: string) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
function DashboardSkeleton() {
  return (
    <div className="grid gap-5 p-8">
      <div className="h-20 animate-pulse rounded-2xl bg-[#f0eef4]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-[#f0eef4]"
          />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl bg-[#f0eef4]" />
    </div>
  );
}
