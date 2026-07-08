"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePlanFeatureAccess, type PlanFeatureKey } from "@/api-hooks/use-plan-capabilities";
import { cn } from "@/lib/utils";

export function PlanFeatureLock({
  feature,
  label,
  children,
  compact = false,
  className,
  bypass = false,
}: {
  feature: PlanFeatureKey;
  label: string;
  children: ReactNode;
  compact?: boolean;
  className?: string;
  bypass?: boolean;
}) {
  const access = usePlanFeatureAccess(feature);
  const locked = !bypass && access.locked;
  const capabilities = access.capabilities;
  return (
    <div className={cn("relative", className)}>
      <div className={cn(locked && "pointer-events-none select-none opacity-45")}>{children}</div>
      {locked && (
        <div className={cn("absolute inset-0 z-20 flex items-center justify-center bg-white/38 backdrop-blur-[1px]", compact && "items-start justify-end bg-transparent p-2 backdrop-blur-none")}>
          <div className={cn("max-w-sm border bg-white p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.16)]", compact && "max-w-none rounded-full border-0 bg-[#111] px-3 py-1.5 text-left text-white shadow-none")}>
            <Lock className={cn("mx-auto size-5", compact && "mr-1.5 inline size-3.5")} />
            <p className={cn("mt-3 text-sm font-bold", compact && "mt-0 inline text-xs")}>{label} is not included in {capabilities?.planName || "your plan"}</p>
            {!compact && <Link href="/dashboard/client-gallery/storage" className="mt-3 inline-flex text-sm font-bold text-[#00a997]">View plans</Link>}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlanFeatureNotice({ feature, label }: { feature: PlanFeatureKey; label: string }) {
  const access = usePlanFeatureAccess(feature);
  if (!access.locked) return null;
  return (
    <div className="mb-5 flex items-center gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Lock className="size-4 shrink-0" />
      <span><b>{label}</b> is visible but disabled on {access.capabilities?.planName || "your current plan"}. <Link href="/dashboard/client-gallery/storage" className="font-bold underline">Upgrade</Link></span>
    </div>
  );
}
