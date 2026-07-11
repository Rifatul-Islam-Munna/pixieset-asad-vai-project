"use client";

import { useQuery } from "@tanstack/react-query";

export type PlanFeatureKey =
  | "pinSet"
  | "downloadLimit"
  | "coverImage"
  | "layouts"
  | "advancedDesign"
  | "customCover"
  | "store"
  | "marketingEmails";

export type PlanCapabilities = {
  planName: string;
  storageLimitGb: number;
  monthlyEmailLimit: number;
  videoUploadLimitMinutes?: number;
  videoUploadQuality?: "hd" | "4k";
  features: Partial<Record<PlanFeatureKey, boolean>>;
};

const freeDesignFeatures = new Set<PlanFeatureKey>([
  "coverImage",
  "layouts",
  "advancedDesign",
  "customCover",
]);

export function usePlanCapabilities() {
  return useQuery<{ data: PlanCapabilities }>({
    queryKey: ["billing-capabilities"],
    queryFn: async () => {
      const response = await fetch("/api/billing/capabilities", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Could not load plan features");
      return payload;
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function usePlanFeatureAccess(feature: PlanFeatureKey) {
  const query = usePlanCapabilities();
  const loading = query.isLoading;
  const enabled =
    freeDesignFeatures.has(feature) ||
    loading ||
    Boolean(query.data?.data?.features?.[feature]);
  return { enabled, locked: !loading && !enabled, loading, capabilities: query.data?.data };
}
