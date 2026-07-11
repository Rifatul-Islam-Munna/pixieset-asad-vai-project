import { PublicCheckoutSuccess } from "@/components/dashboard/public-checkout-success";

export default async function CollectionStoreSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string; galary: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { galary } = await params;
  const { session_id } = await searchParams;

  return (
    <PublicCheckoutSuccess
      sessionId={session_id}
      backHref={`/${encodeURIComponent(galary)}`}
    />
  );
}
