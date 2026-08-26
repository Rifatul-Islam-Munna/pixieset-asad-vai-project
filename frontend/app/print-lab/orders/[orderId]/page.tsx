import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type LabOrder = {
  id: string;
  orderNumber: string;
  galleryName: string;
  mode: "free" | "paid";
  customer: { name: string; email: string; phone?: string; address?: Record<string, unknown> };
  items: Array<{
    imageId?: string;
    filename: string;
    available: boolean;
    name: string;
    type: string;
    variantLabel?: string;
    options: Record<string, string>;
    crop?: unknown;
    quantity: number;
  }>;
  shippingMethodName?: string;
  shippingNote?: string;
  note?: string;
  createdAt?: string;
};

function Unavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f3ef] px-6 text-[#252525]">
      <section className="w-full max-w-lg border border-black/10 bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6d5bbd]">Gallerista Print Lab</p>
        <h1 className="mt-4 text-3xl font-semibold">This print order is unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-black/60">The secure link may be invalid, expired, or replaced by a newer delivery link.</p>
      </section>
    </main>
  );
}

function addressText(address?: Record<string, unknown>) {
  if (!address) return "";
  return Object.values(address)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export default async function PrintLabOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orderId } = await params;
  const { token = "" } = await searchParams;
  if (!token) return <Unavailable />;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return <Unavailable />;
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const response = await fetch(
    `${protocol}://${host}/api/print-lab/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!response?.ok) return <Unavailable />;
  const payload = (await response.json().catch(() => null)) as { data?: LabOrder } | null;
  const order = payload?.data;
  if (!order) return <Unavailable />;

  const address = addressText(order.customer.address);
  const createdAt = order.createdAt ? new Date(order.createdAt) : null;
  const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
    : "";

  return (
    <main className="min-h-screen bg-[#f5f3ef] px-4 py-8 text-[#242424] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="border border-black/10 bg-[#242323] px-6 py-7 text-white sm:px-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c9bdf6]">Gallerista / Print Fulfillment</p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{order.orderNumber || "Print order"}</h1>
              <p className="mt-2 text-sm text-white/65">{order.galleryName || "Gallery"}{createdLabel ? ` · ${createdLabel}` : ""}</p>
            </div>
            <span className="border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              {order.mode === "free" ? "Free print request" : "Paid print order"}
            </span>
          </div>
        </header>

        <section className="grid border-x border-b border-black/10 bg-white md:grid-cols-2">
          <div className="border-b border-black/10 p-6 md:border-b-0 md:border-r sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Customer</p>
            <h2 className="mt-3 text-xl font-semibold">{order.customer.name || "Customer"}</h2>
            <p className="mt-2 text-sm text-black/65">{order.customer.email}</p>
            {order.customer.phone && <p className="mt-1 text-sm text-black/65">{order.customer.phone}</p>}
            {address && <p className="mt-4 max-w-md text-sm leading-6 text-black/55">{address}</p>}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Fulfillment notes</p>
            <p className="mt-3 text-sm leading-6 text-black/70">{order.note || "No customer note."}</p>
            {order.shippingMethodName && <p className="mt-4 text-sm"><strong>Shipping:</strong> {order.shippingMethodName}</p>}
            {order.shippingNote && <p className="mt-1 text-sm text-black/60">{order.shippingNote}</p>}
          </div>
        </section>

        <section className="mt-7 border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-5 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Selected photos</p>
              <h2 className="mt-1 text-xl font-semibold">Print list</h2>
            </div>
            <span className="text-sm tabular-nums text-black/55">{order.items.length} item{order.items.length === 1 ? "" : "s"}</span>
          </div>
          <div className="divide-y divide-black/10">
            {order.items.map((item, index) => {
              const imageHref = item.imageId
                ? `/api/print-lab/orders/${encodeURIComponent(order.id)}/images/${encodeURIComponent(item.imageId)}?token=${encodeURIComponent(token)}`
                : "";
              return (
                <article key={`${item.imageId ?? item.filename}-${index}`} className="grid gap-5 p-6 sm:grid-cols-[160px_1fr_auto] sm:p-8">
                  <div className="aspect-[4/3] overflow-hidden bg-[#ece9e3]">
                    {item.available && imageHref ? (
                      <img src={imageHref} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center px-4 text-center text-xs uppercase tracking-[0.16em] text-black/35">Photo unavailable</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{item.name || item.filename || "Print item"}</h3>
                        <p className="mt-1 break-all text-xs text-black/45">{item.filename}</p>
                        {(item.variantLabel || item.type) && (
                          <p className="mt-2 text-sm text-black/60">{item.variantLabel || item.type}</p>
                        )}
                      </div>
                      <span className="border border-black/10 bg-[#f7f5f0] px-3 py-2 text-sm font-semibold tabular-nums">
                        Qty {item.quantity}
                      </span>
                    </div>
                    {Object.keys(item.options ?? {}).length > 0 && (
                      <dl className="mt-5 grid gap-2 sm:grid-cols-2">
                        {Object.entries(item.options).map(([label, value]) => (
                          <div key={label} className="border border-black/10 bg-[#faf9f6] px-3 py-2">
                            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">{label}</dt>
                            <dd className="mt-1 text-sm font-medium">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>                  <div className="flex items-start justify-start sm:justify-end">
                    {item.available && imageHref ? (
                      <a
                        href={imageHref}
                        className="inline-flex h-10 items-center border border-black/20 px-4 text-sm font-semibold transition hover:bg-black hover:text-white"
                      >
                        Download original
                      </a>
                    ) : (
                      <span className="text-xs uppercase tracking-[0.14em] text-black/35">Unavailable</span>
                    )}
                  </div>
                </article>
              );
            })}
            {order.items.length === 0 && (
              <div className="p-10 text-center text-sm text-black/50">No print items were included with this order.</div>
            )}
          </div>
        </section>

        <footer className="py-7 text-center text-xs uppercase tracking-[0.18em] text-black/35">
          Secure print fulfillment link - Gallerista
        </footer>
      </div>
    </main>
  );
}