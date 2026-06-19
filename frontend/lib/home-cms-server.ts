import { mergeHomeCms, type HomeCmsData } from "@/lib/home-cms";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

export async function getHomeCms() {
  try {
    const response = await fetch(`${baseUrl}/home-cms`, { cache: "no-store" });
    const payload = await response.json();
    return mergeHomeCms(payload?.data as Partial<HomeCmsData>);
  } catch {
    return mergeHomeCms();
  }
}
