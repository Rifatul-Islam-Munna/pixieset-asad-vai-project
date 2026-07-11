import Link from "next/link";
import { CircleUserRound, Images, LayoutGrid, Smartphone, Store } from "lucide-react";
import { getBillingOverview, getPurchaseHistory } from "@/actions/billing";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const [{ user }, purchases] = await Promise.all([getBillingOverview(), getPurchaseHistory()]);
  const items = [
    { title: "Client Gallery", text: "Share, deliver, proof and sell", href: "/dashboard/client-gallery", icon: Images, color: "bg-[#1fc7b5]" },
    { title: "Store Gallery", text: "Sell prints and digital downloads", href: "/dashboard/store-gallery", icon: Store, color: "bg-[#ff6671]" },
    { title: "Mobile Gallery App", text: "Create installable mobile galleries", href: "/dashboard/mobile-gallery", icon: Smartphone, color: "bg-[#f5c842]" },
    { title: "Profile & Account", text: "Identity, username, subdomain and security", href: "/dashboard/client-gallery/account", icon: CircleUserRound, color: "bg-[#202020]" },
  ];
  return <main className="min-h-screen bg-[#f7f7f5] px-5 py-12 text-[#171717] md:px-10 md:py-20"><div className="mx-auto max-w-[1100px]"><header className="flex flex-wrap items-end justify-between gap-6 border-b border-[#ddd] pb-8"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#00a997]">Gallerista workspace</p><h1 className="mt-3 text-4xl font-medium">Welcome, {user.name || "Creator"}</h1></div><div className="bg-white px-5 py-3 text-sm shadow-sm"><b>{user.planName || "Free"}</b> plan</div></header><section className="mt-10 grid gap-5 sm:grid-cols-2">{items.map((item) => <Link key={item.title} href={item.href} className="group flex min-h-48 flex-col justify-between bg-white p-7 shadow-[0_12px_35px_rgba(0,0,0,.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,.10)]"><span className={`flex size-12 items-center justify-center rounded-full text-white ${item.color}`}><item.icon className="size-5" /></span><div><h2 className="text-xl font-bold">{item.title}</h2><p className="mt-2 text-sm text-[#777]">{item.text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#00a997]">Open <LayoutGrid className="size-4" /></span></div></Link>)}</section><section className="mt-10 bg-white p-7"><h2 className="text-lg font-bold">Recent plan history</h2>{purchases.length ? <div className="mt-5 divide-y">{purchases.slice(0, 5).map((purchase) => <div key={purchase._id} className="flex items-center justify-between gap-4 py-4 text-sm"><div><b>{purchase.planName}</b><p className="mt-1 text-xs capitalize text-[#888]">{purchase.source} · {purchase.status}</p></div><div className="text-right"><b>${Number(purchase.amount).toFixed(2)}</b><p className="mt-1 text-xs text-[#888]">{new Date(purchase.createdAt).toLocaleDateString()}</p></div></div>)}</div> : <p className="mt-4 text-sm text-[#888]">No plan purchases yet.</p>}</section></div></main>;
}
