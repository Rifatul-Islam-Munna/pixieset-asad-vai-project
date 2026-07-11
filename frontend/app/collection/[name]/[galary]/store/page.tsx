import { redirect } from "next/navigation";

export default async function CollectionStorePage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { galary } = await params;
  redirect(`/${encodeURIComponent(galary)}`);
}
