import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeDollarSign,
  Camera,
  CircleUserRound,
  CreditCard,
  Crown,
  Images,
  LayoutGrid,
  Mail,
  Palette,
  ReceiptText,
  Settings,
  Smartphone,
  Store,
} from "lucide-react";
import { getBillingOverview, getPurchaseHistory } from "@/actions/billing";
import { getHomeCms } from "@/lib/home-cms-server";

export const dynamic = "force-dynamic";

const baseUrl =
  process.env.BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:4000";

type ListResponse<T> = { data: T };

type OverviewCollection = {
  _id: string;
  name: string;
  slug?: string;
  coverImage?: string;
  imageCount?: number;
  status?: string;
  createdAt?: string;
  eventDate?: string;
};

type OverviewOrder = {
  _id: string;
  orderNumber: string;
  customer?: { name?: string; email?: string };
  total?: number;
  status?: string;
  paymentStatus?: string;
  createdAt?: string;
};

async function authedOverviewRequest<T>(path: string, fallback: T): Promise<T> {
  const token = (await cookies()).get("access_token")?.value;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { access_token: token ?? "" },
    cache: "no-store",
  }).catch(() => null);
  if (response?.status === 401 || response?.status === 403) redirect("/login");
  if (!response?.ok) return fallback;
  const payload = (await response
    .json()
    .catch(() => null)) as ListResponse<T> | null;
  return payload?.data ?? fallback;
}

const products = [
  {
    title: "Client Gallery",
    icon: Images,
    color: "bg-[#6337d8]",
    links: [
      ["Manage Galleries", "/dashboard/client-gallery"],
      ["Create Gallery", "/dashboard/client-gallery/collection-new"],
      ["View Homepage", "/dashboard/client-gallery/homepage"],
      ["Settings", "/dashboard/client-gallery/settings"],
    ],
  },
  {
    title: "Store",
    icon: Store,
    color: "bg-[#6337d8]",
    links: [
      ["View Orders", "/dashboard/store-gallery/orders"],
      ["Products", "/dashboard/store-gallery/products"],
      ["Settings", "/dashboard/store-gallery/settings"],
    ],
  },
  {
    title: "Mobile Gallery App",
    icon: Smartphone,
    color: "bg-[#6337d8]",
    links: [
      ["Manage Apps", "/dashboard/mobile-gallery"],
      ["Create New App", "/dashboard/mobile-gallery"],
      ["Settings", "/dashboard/mobile-gallery/settings"],
    ],
  },
  {
    title: "Profile & Account",
    icon: CircleUserRound,
    color: "bg-[#6337d8]",
    links: [
      ["Profile", "/dashboard/client-gallery/account"],
      ["Account", "/dashboard/client-gallery/account"],
      ["Billing", "/dashboard/client-gallery/storage"],
      ["Preferences", "/dashboard/client-gallery/settings/preferences"],
    ],
  },
];

function assetSrc(url?: string) {
  if (!url) return "";
  if (/^(https?:|data:|blob:|\/)/i.test(url)) return url;
  return `${baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

export default async function DashboardOverviewPage() {
  const [{ user }, purchases, collections, orders, cms] = await Promise.all([
    getBillingOverview(),
    getPurchaseHistory(),
    authedOverviewRequest<OverviewCollection[]>("/collections", []),
    authedOverviewRequest<OverviewOrder[]>("/store/orders", []),
    getHomeCms(),
  ]);
  const brandLogo = cms.brand.logoUrl?.trim() || cms.brand.brandImageUrl?.trim() || "";
  const brandText = cms.brand.brandText?.trim() || "";
  const recentCollections = collections.slice(0, 4);
  const recentOrders = orders.slice(0, 4);
  const planNotExpired = !user.planExpiresAt || new Date(user.planExpiresAt).getTime() > Date.now();
  const hasAssignedPaidPlan = Boolean(user.planId) || Boolean(user.planName && !/^free$/i.test(user.planName.trim()));
  const hasPaidPurchase = purchases.some((purchase) => purchase.amount > 0 && (purchase.status === "active" || purchase.status === "paid"));
  const isPlus = planNotExpired && (hasAssignedPaidPlan || hasPaidPurchase);

  return (
    <main className="min-h-screen bg-[#fbfbfd] text-[#171717]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[255px] border-r border-[#ececf1] bg-white md:flex md:flex-col">
        <Link href="/" className="flex h-[78px] min-w-0 items-center border-b border-[#f0f0f3] px-7 text-lg font-bold" aria-label={brandLogo ? "Home" : brandText || "Home"}>
          {brandLogo ? (
            <img src={brandLogo} alt="" className="h-11 w-auto max-w-[190px] object-contain" />
          ) : brandText ? (
            <span className="max-w-[190px] truncate">{brandText}</span>
          ) : null}
        </Link>
        <nav className="flex-1 px-5 py-6 text-sm font-medium text-[#3f3d47]">
          <div className="grid gap-2">
            <Link href="/dashboard/overview" className="flex h-12 items-center gap-4 rounded-[8px] bg-[#f1ecff] px-4 font-semibold text-[#6237d8]"><LayoutGrid className="size-5" />Dashboard</Link>
            <Link href="/dashboard/client-gallery" className="flex h-12 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><Images className="size-5" />Client Gallery</Link>
            <Link href="/dashboard/store-gallery" className="flex h-12 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><Store className="size-5" />Store</Link>
            <Link href="/dashboard/mobile-gallery" className="flex h-12 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><Smartphone className="size-5" />Mobile Gallery App</Link>
            <Link href="/dashboard/client-gallery/account" className="flex h-12 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><CircleUserRound className="size-5" />Profile & Account</Link>
          </div>
          <div className="my-6 border-t border-[#eeeeef]" />
          <p className="px-4 text-[10px] font-bold uppercase tracking-[.18em] text-[#9996a1]">Quick Access</p>
          <div className="mt-4 grid gap-2">
            <Link href="/dashboard/client-gallery" className="flex h-11 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><Images className="size-5" />Recent Collections</Link>
            <Link href="/dashboard/store-gallery/orders" className="flex h-11 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><Store className="size-5" />Recent Orders</Link>
            <Link href="/dashboard/client-gallery/storage" className="flex h-11 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><ReceiptText className="size-5" />Recent Plan History</Link>
            <Link href="/dashboard/client-gallery/account" className="flex h-11 items-center gap-4 rounded-[8px] px-4 hover:bg-[#f7f7fa]"><BadgeDollarSign className="size-5" />Account</Link>
          </div>
        </nav>
        {!isPlus && (
          <div className="m-5 rounded-[12px] bg-gradient-to-br from-[#f1ebff] to-[#e9ddff] p-5">
            <Crown className="size-7 text-[#6237d8]" />
            <h3 className="mt-4 font-bold">Upgrade to Plus</h3>
            <p className="mt-2 text-xs leading-5 text-[#726d7d]">Unlock premium features and grow your business.</p>
            <Link href="/pricing" className="mt-5 flex h-10 items-center justify-center gap-2 rounded-[7px] bg-gradient-to-r from-[#5425c8] to-[#7436df] text-sm font-semibold text-white">Upgrade Now <ArrowRight className="size-4" /></Link>
          </div>
        )}
      </aside>
      <section className="min-h-screen px-5 py-10 md:pl-[295px] md:pr-10 md:py-14">
      <div className="mx-auto max-w-[1080px]">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-medium">Dashboard</h1>
            <p className="mt-2 text-sm text-[#777]">
              Welcome, {user.name || "Creator"}
            </p>
          </div>
          <Link
            href="/dashboard/client-gallery/account"
            className="inline-flex h-11 items-center gap-2 border px-4 text-sm font-semibold"
          >
            <CircleUserRound className="size-4" />
            Profile & Account
          </Link>
        </header>

        <section className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8a8f98]">
            Products
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <div key={product.title} className="min-w-0 rounded-[10px] border border-[#ececf1] bg-white p-5 shadow-[0_8px_24px_rgba(38,31,61,.04)]">
                <div className="flex items-center gap-4">
                  <span className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white ${product.color}`}>
                    <product.icon className="size-5" />
                  </span>
                  <h2 className="truncate text-[15px] font-bold">{product.title}</h2>
                </div>
                <div className="mt-4 border-t border-[#eeeeef] pt-4">
                  <div className="grid gap-3 text-[13px] text-[#5f6670]">
                    {product.links.map(([label, href]) => (
                      <Link
                        key={label}
                        href={href}
                        className="transition hover:text-black"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8a8f98]">
            Quick Access
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="bg-[#f6f6f4] p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="inline-flex items-center gap-3 text-sm font-bold uppercase tracking-[0.12em]">
                  <Images className="size-4 text-[#09bfb4]" />
                  Recent Galleries
                </h2>
                <Link
                  href="/dashboard/client-gallery"
                  aria-label="Open galleries"
                >
                  <LayoutGrid className="size-4 text-[#777]" />
                </Link>
              </div>
              <div className="mt-6 grid gap-3">
                {recentCollections.length ? (
                  recentCollections.map((collection) => (
                    <Link
                      key={collection._id}
                      href={`/dashboard/client-gallery/collections/${collection._id}`}
                      className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 bg-white p-3 text-sm transition hover:bg-[#fbfbfb]"
                    >
                      {collection.coverImage ? (
                        <img
                          src={assetSrc(collection.coverImage)}
                          alt=""
                          className="size-[72px] object-cover"
                        />
                      ) : (
                        <span className="flex size-[72px] items-center justify-center bg-[#efefec]">
                          <Images className="size-5 text-[#777]" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <b className="block truncate uppercase">
                          {collection.name}
                        </b>
                        <span className="mt-1 block text-xs text-[#777]">
                          {formatDate(
                            collection.eventDate || collection.createdAt,
                          )}
                        </span>
                        <span className="mt-2 block text-xs text-[#555]">
                          {collection.imageCount ?? 0} photos
                        </span>
                      </span>
                      <span className="text-xs capitalize text-[#777]">
                        {collection.status ?? "draft"}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="flex min-h-36 items-center justify-center bg-white text-sm font-semibold text-[#555]">
                    No galleries yet.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-[#f6f6f4] p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="inline-flex items-center gap-3 text-sm font-bold uppercase tracking-[0.12em]">
                  <Store className="size-4 text-[#fb4857]" />
                  Recent Orders
                </h2>
                <Link
                  href="/dashboard/store-gallery/orders"
                  aria-label="Open orders"
                >
                  <LayoutGrid className="size-4 text-[#777]" />
                </Link>
              </div>
              <div className="mt-6 grid gap-3">
                {recentOrders.length ? (
                  recentOrders.map((order) => (
                    <Link
                      key={order._id}
                      href="/dashboard/store-gallery/orders"
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-white p-4 text-sm transition hover:bg-[#fbfbfb]"
                    >
                      <span className="min-w-0">
                        <b className="block truncate">{order.orderNumber}</b>
                        <span className="mt-1 block truncate text-xs text-[#777]">
                          {order.customer?.name ||
                            order.customer?.email ||
                            "Customer"}
                        </span>
                        <span className="mt-2 block text-xs capitalize text-[#555]">
                          {order.status ?? "pending"} /{" "}
                          {order.paymentStatus ?? "unpaid"}
                        </span>
                      </span>
                      <span className="text-right">
                        <b>{Number(order.total ?? 0).toFixed(2)}</b>
                        <span className="mt-1 block text-xs text-[#777]">
                          {formatDate(order.createdAt)}
                        </span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="flex min-h-36 items-center justify-center bg-white text-sm font-semibold text-[#555]">
                    No orders yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-[#f6f6f4] p-6">
            <h2 className="inline-flex items-center gap-3 text-sm font-bold uppercase tracking-[0.12em]">
              <CreditCard className="size-4 text-[#111]" />
              Recent Plan History
            </h2>
            {purchases.length ? (
              <div className="mt-5 divide-y bg-white">
                {purchases.slice(0, 5).map((purchase) => (
                  <div
                    key={purchase._id}
                    className="flex items-center justify-between gap-4 px-4 py-4 text-sm"
                  >
                    <div>
                      <b>{purchase.planName}</b>
                      <p className="mt-1 text-xs capitalize text-[#888]">
                        {purchase.source} / {purchase.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <b>{Number(purchase.amount).toFixed(2)}</b>
                      <p className="mt-1 text-xs text-[#888]">
                        {new Date(purchase.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex min-h-36 items-center justify-center bg-white text-sm font-semibold">
                No plan purchases yet.
              </div>
            )}
          </div>

          <div className="bg-[#f6f6f4] p-6">
            <h2 className="inline-flex items-center gap-3 text-sm font-bold uppercase tracking-[0.12em]">
              <BadgeDollarSign className="size-4 text-[#ffc400]" />
              Account
            </h2>
            <div className="mt-6 grid gap-3 bg-white p-5 text-sm">
              <p>
                <b>{user.planName || "Free"}</b> plan
              </p>
              <Link
                href="/dashboard/client-gallery/storage"
                className="inline-flex items-center gap-2 font-semibold text-[#555] hover:text-black"
              >
                <CreditCard className="size-4" />
                Billing & storage
              </Link>
              <Link
                href="/dashboard/client-gallery/settings/branding"
                className="inline-flex items-center gap-2 font-semibold text-[#555] hover:text-black"
              >
                <Palette className="size-4" />
                Branding
              </Link>
              <Link
                href="/dashboard/client-gallery/settings/preferences"
                className="inline-flex items-center gap-2 font-semibold text-[#555] hover:text-black"
              >
                <Settings className="size-4" />
                Preferences
              </Link>
              <Link
                href="/dashboard/client-gallery/marketing/settings"
                className="inline-flex items-center gap-2 font-semibold text-[#555] hover:text-black"
              >
                <Mail className="size-4" />
                Email settings
              </Link>
            </div>
          </div>
        </section>
      </div>
      </section>
    </main>
  );
}
