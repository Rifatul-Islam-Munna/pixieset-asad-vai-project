import { mergeHomeCms, type HomeCmsData } from "@/lib/home-cms";
import { apiBaseUrl } from "@/lib/api-base-url";

export async function getHomeCms() {
  try {
    const response = await fetch(`${apiBaseUrl()}/home-cms`, {
      cache: "no-store",
      next: { revalidate: 0 },
      headers: { "Cache-Control": "no-cache, no-store" },
    });
    if (!response.ok) throw new Error(`Home CMS request failed (${response.status})`);
    const payload = await response.json();
    return mergeHomeCms(payload?.data as Partial<HomeCmsData>);
  } catch (error) {
    console.error("Home CMS fetch failed", error);
    return mergeHomeCms();
  }
}
