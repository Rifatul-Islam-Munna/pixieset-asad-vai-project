"use client";

import Link from "next/link";
import { BarChart3, FileImage, Package, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Admin dashboard", icon: BarChart3 },
  { href: "/admin/cover-templates", label: "Cover templates", icon: FileImage },
  { href: "/admin/default-products", label: "Default products", icon: ShoppingBag },
];

export function AdminResourceShell({ active, title, subtitle, action, children }: {
  active: "covers" | "products";
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const activeHref = active === "covers" ? "/admin/cover-templates" : "/admin/default-products";
  return (
    <main className="min-h-screen bg-[#f3f3f1] text-[#171717]">
      <div className="grid min-h-screen lg:grid-cols-[250px_1fr]">
        <aside className="border-r bg-white p-5 lg:p-6">
<Link href="/admin" className="flex items-center gap-3 text-lg font-bold"><span className="flex size-9 items-center justify-center bg-[#111] text-white"><Package className="size-4" /></span>Admin</Link>
<nav className="mt-10 grid gap-2">
  {links.map((item) => <Link key={item.href} href={item.href} className={cn("flex h-11 items-center gap-3 px-3 text-sm font-bold", item.href === activeHref ? "bg-[#111] text-white" : "text-[#555] hover:bg-[#f3f3f3]")}><item.icon className="size-4" />{item.label}</Link>)}
</nav>
        </aside>
        <section className="min-w-0 p-4 sm:p-7 lg:p-10">
<div className="flex flex-wrap items-start justify-between gap-5 border-b pb-6">
  <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777]">Admin management</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#666]">{subtitle}</p></div>
  {action}
</div>
<div className="mt-7">{children}</div>
        </section>
      </div>
    </main>
  );
}
