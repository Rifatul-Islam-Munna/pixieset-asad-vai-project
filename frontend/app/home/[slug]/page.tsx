import { notFound } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";
import { PublicHomepage, type PublicHomepageData } from "@/components/dashboard/public-homepage";

export const dynamic = "force-dynamic";

function gaIdFrom(data: PublicHomepageData) {
  const settings = data.integrations?.googleAnalytics;
  const id = String(settings?.measurementId ?? "").trim().toUpperCase();
  return settings?.enabled && /^G-[A-Z0-9]+$/.test(id) ? id : "";
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${baseUrl}/public/homepages/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Could not load homepage");
  const payload = (await response.json()) as { data: PublicHomepageData };
  const gaId = gaIdFrom(payload.data);
  return (
    <>
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <PublicHomepage initialData={payload.data} />
    </>
  );
}
