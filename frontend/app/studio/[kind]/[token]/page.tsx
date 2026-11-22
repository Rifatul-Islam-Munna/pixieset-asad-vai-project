import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioPublic } from "@/components/studio/studio-public";
import {StudioPaymentCheckout} from "@/components/studio/studio-payment-checkout";
import type {PublicPaymentLink} from "@/actions/studio-payment-links";
import { apiBaseUrl } from "@/lib/api-base-url";

export const metadata: Metadata = {
  title: "Studio document | Gallerista",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudioPublicPage({
  params,
}: {
  params: Promise<{ kind: string; token: string }>;
}) {
  const { kind, token } = await params;
  const paths: Record<string, string> = {
    form: "forms",
    invoice: "invoices",
    contract: "contracts",
    payment: "payment-links",
    questionnaire: "questionnaires",
    quote: "quotes",
  };
  if (!paths[kind] || !/^[a-f0-9]{64}$/i.test(token)) notFound();

  const response = await fetch(
    apiBaseUrl() + "/public/studio/" + paths[kind] + "/" + encodeURIComponent(token) + (kind==="payment"?"/details":""),
    { cache: "no-store" },
  ).catch(() => null);
  if (!response?.ok) notFound();
  const payload = await response.json().catch(() => null);
  if (!payload?.data) notFound();

  if(kind==="payment")return <StudioPaymentCheckout data={payload.data as PublicPaymentLink}/>;
  return <StudioPublic kind={kind as "form" | "invoice" | "contract" | "questionnaire" | "quote"} token={token} data={payload.data} />;
}
