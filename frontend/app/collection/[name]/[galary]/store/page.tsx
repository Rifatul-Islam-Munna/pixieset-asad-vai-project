import { redirect } from "next/navigation";

export default async function CollectionStorePage({
  params,
}: {
  params: Promise<{ name: string; galary: string }>;
}) {
  const { name, galary } = await params;
  redirect(`/collection/${encodeURIComponent(name)}/${encodeURIComponent(galary)}`);
}
