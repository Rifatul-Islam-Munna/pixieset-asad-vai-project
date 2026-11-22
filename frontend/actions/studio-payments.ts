"use server";

import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {apiBaseUrl} from "@/lib/api-base-url";
import {BackendRequestError,fetchBackendJson} from "@/lib/backend-request";

export type StudioPaymentSettings={
  currency:"EUR";
  sharedWithStore:true;
  stripe:{enabled:boolean;ready:boolean;publishableKey:string;hasSecret:boolean;mode:"live"|"test"|null};
  paypal:{enabled:boolean;ready:boolean;clientId:string;hasSecret:boolean;environment:"sandbox"|"live";hasWebhookId:boolean};
};
export type StudioPaymentUpdate={
  stripe?:{enabled:boolean;publishableKey:string;secretKey?:string};
  paypal?:{enabled:boolean;environment:"sandbox"|"live";clientId:string;clientSecret?:string;webhookId?:string};
};
type StudioPaymentMethod="stripe"|"paypal";
const validToken=(value:string)=>/^[a-f0-9]{64}$/i.test(value);

async function authorized<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
  const accessToken=(await cookies()).get("access_token")?.value;
  if(!accessToken)redirect("/login");
  try{
    const result=await fetchBackendJson<{data:T}>(apiBaseUrl()+path,{
      method,headers:{access_token:accessToken,"content-type":"application/json"},
      ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",
    });
    return result.data;
  }catch(error){
    if(error instanceof BackendRequestError&&error.statusCode===401)redirect("/login");
    throw error;
  }
}
async function publicRequest<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
  const result=await fetchBackendJson<{data:T}>(apiBaseUrl()+path,{
    method,headers:{"content-type":"application/json"},
    ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",
  });
  return result.data;
}
export async function studioPaymentSettings(){
  return authorized<StudioPaymentSettings>("/studio/payments/settings");
}
export async function studioSavePaymentSettings(input:StudioPaymentUpdate){
  return authorized<StudioPaymentSettings>("/studio/payments/settings","PATCH",input as Record<string,unknown>);
}
export async function studioTestPayPal(){
  return authorized<{success:boolean;environment:string}>("/studio/payments/paypal/test","POST");
}
export async function publicStudioInvoicePaymentMethods(token:string){
  if(!validToken(token))return {stripe:false,paypal:false};
  return publicRequest<{stripe:boolean;paypal:boolean}>("/public/studio/invoices/"+encodeURIComponent(token)+"/methods");
}
export async function startStudioInvoiceCheckout(token:string,provider:StudioPaymentMethod){
  if(!validToken(token)||!["stripe","paypal"].includes(provider))throw Error("Invalid checkout request");
  return publicRequest<{provider:StudioPaymentMethod;url:string}>(
    "/public/studio/invoices/"+encodeURIComponent(token)+"/checkout","POST",{provider});
}
export async function verifyStudioInvoiceCheckout(token:string,provider:StudioPaymentMethod,referenceId:string){
  if(!validToken(token)||!["stripe","paypal"].includes(provider)||!/^[a-zA-Z0-9_-]{7,200}$/.test(referenceId))
    throw Error("Invalid checkout verification request");
  return publicRequest<{paid:boolean;alreadyPaid:boolean}>(
    "/public/studio/invoices/"+encodeURIComponent(token)+"/verify","POST",{provider,referenceId});
}
