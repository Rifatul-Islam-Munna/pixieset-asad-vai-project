"use server";

import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {apiBaseUrl} from "@/lib/api-base-url";
import {BackendRequestError,fetchBackendJson} from "@/lib/backend-request";

export type PaymentLinkConfig={
  slug:string;siteSlug:string;coverImageUrl:string;fixedAmount:boolean;
  allowCustomAmount:boolean;presetAmounts:number[];allowTips:boolean;
  tipPresets:number[];confirmationMessage:string;createProject:boolean;
  projectType:string;projectStage:string;notes:string;
};
export type PublicPaymentLink=PaymentLinkConfig&{
  token:string;title:string;description:string;currency:string;amount:number;
  expiresAt:string|null;onlinePaymentEnabled:boolean;
  methods:{stripe:boolean;paypal:boolean};
};
export type StudioSite={slug:string;name:string};
export type StudioSites={sites:StudioSite[];rootDomain:string};
type Provider="stripe"|"paypal";
const validToken=(input:string)=>/^[a-f0-9]{64}$/i.test(input);
async function publicRequest<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
  const data=await fetchBackendJson<{data:T}>(apiBaseUrl()+path,{
    method,headers:{"content-type":"application/json"},
    ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",
  });
  return data.data;
}
export async function studioPaymentLinkSites():Promise<StudioSites>{
  const token=(await cookies()).get("access_token")?.value;
  if(!token)redirect("/login");
  try{
    const data=await fetchBackendJson<{data:StudioSites}>(apiBaseUrl()+"/studio/payment-links/sites",{
      headers:{access_token:token},cache:"no-store",
    });
    return data.data;
  }catch(error){
    if(error instanceof BackendRequestError&&error.statusCode===401)redirect("/login");
    throw error;
  }
}
export async function studioStartLinkCheckout(input:{
  token:string;provider:Provider;amount:number;tip:number;
  firstName:string;lastName:string;email:string;message:string;
}):Promise<{provider:Provider;url:string}>{
  if(!validToken(input.token)||!["stripe","paypal"].includes(input.provider))
    throw Error("Invalid payment link");
  return publicRequest<{provider:Provider;url:string}>(
    "/public/studio/payment-links/"+encodeURIComponent(input.token)+"/checkout","POST",
    {...input});
}
export async function studioVerifyLinkCheckout(input:{
  token:string;provider:Provider;referenceId:string;
}):Promise<{paid:boolean;alreadyPaid:boolean;projectId:string|null;confirmationMessage:string}>{
  if(!validToken(input.token)||!["stripe","paypal"].includes(input.provider)||
    !/^[a-zA-Z0-9_-]{7,200}$/.test(input.referenceId))
    throw Error("Invalid payment verification reference");
  return publicRequest(
    "/public/studio/payment-links/"+encodeURIComponent(input.token)+"/verify","POST",
    {provider:input.provider,referenceId:input.referenceId});
}
