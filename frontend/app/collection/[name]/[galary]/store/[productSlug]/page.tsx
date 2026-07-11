import { redirect } from "next/navigation";

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { galary } = await params;
  redirect(`/${encodeURIComponent(galary)}`);
}
