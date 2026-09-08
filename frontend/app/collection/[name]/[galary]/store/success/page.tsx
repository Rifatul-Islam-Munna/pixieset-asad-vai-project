import { PublicCheckoutSuccess } from "@/components/dashboard/public-checkout-success";

export default async function CollectionStoreSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string; galary: string }>;
  searchParams: Promise<{ session_id?: string; provider?: string; token?: string }>;
}) {
  const { galary } = await params;
  const { session_id, provider, token } = await searchParams;

  return (
    <PublicCheckoutSuccess
      sessionId={session_id}
      paypalOrderId={provider === "paypal" ? token : undefined}
      backHref={`/${encodeURIComponent(galary)}`}
    />
  );
}
