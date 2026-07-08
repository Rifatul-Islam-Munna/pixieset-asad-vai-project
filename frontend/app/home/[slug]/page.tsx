import { notFound } from "next/navigation";
import { PublicHomepage, type PublicHomepageData } from "@/components/dashboard/public-homepage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${baseUrl}/public/homepages/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Could not load homepage");
  const payload = (await response.json()) as { data: PublicHomepageData };
  return <PublicHomepage initialData={payload.data} />;
}
