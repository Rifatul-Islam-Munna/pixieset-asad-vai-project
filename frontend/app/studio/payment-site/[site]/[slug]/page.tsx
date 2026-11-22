import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {apiBaseUrl} from "@/lib/api-base-url";
import {StudioPaymentCheckout} from "@/components/studio/studio-payment-checkout";
import type {PublicPaymentLink} from "@/actions/studio-payment-links";

export const metadata:Metadata={
  title:"Studio Payment | Gallerista",
  robots:{index:false,follow:false},
};
export const dynamic="force-dynamic";
export default async function StudioSubdomainPaymentPage({
  params,
}:{params:Promise<{site:string;slug:string}>}){
  const {site,slug}=await params;
  const valid=/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
  if(!valid.test(site)||!valid.test(slug))notFound();
  const result=await fetch(
    apiBaseUrl()+"/public/studio/payment-links/site/"+encodeURIComponent(site)+"/"+encodeURIComponent(slug),
    {cache:"no-store"},
  ).catch(()=>null);
  if(!result?.ok)notFound();
  const payload=await result.json().catch(()=>null);
  if(!payload?.data?.token)notFound();
  return <StudioPaymentCheckout data={payload.data as PublicPaymentLink}/>;
}
