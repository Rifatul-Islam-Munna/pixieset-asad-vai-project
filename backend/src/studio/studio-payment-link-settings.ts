import {BadRequestException} from '@nestjs/common';

export type PaymentLinkConfig={
  slug:string;siteSlug:string;coverImageUrl:string;fixedAmount:boolean;
  allowCustomAmount:boolean;presetAmounts:number[];allowTips:boolean;
  tipPresets:number[];confirmationMessage:string;createProject:boolean;
  projectType:string;projectStage:string;notes:string;
};
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const amount=(raw:unknown,max=1000000)=>{
  const value=Number(raw);
  if(!Number.isFinite(value)||value<=0||value>max||Math.abs(Math.round(value*100)-value*100)>0.000001)
    throw new BadRequestException('Payment amount must be positive and use at most two decimals');
  return value;
};
export function normalizePaymentLinkSettings(raw:Record<string,unknown>):PaymentLinkConfig {
  const slug=String(raw.slug??'').trim().toLowerCase();
  if(!slugPattern.test(slug))throw new BadRequestException('Payment URL must use 1–50 lowercase letters, numbers or hyphens');
  const siteSlug=String(raw.siteSlug??'').trim().toLowerCase();
  if(siteSlug&&!slugPattern.test(siteSlug))
    throw new BadRequestException('Invalid studio subdomain');
  const coverImageUrl=String(raw.coverImageUrl??'').trim();
  if(coverImageUrl){
    let url:URL;
    try{url=new URL(coverImageUrl);}catch{throw new BadRequestException('Invalid cover image URL');}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||
      (url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname))||
      coverImageUrl.length>2048)
      throw new BadRequestException('Cover image must use a safe web URL');
  }
  const preset=(values:unknown,maxItems:number,cap:number)=>{
    if(!Array.isArray(values)||values.length>maxItems)
      throw new BadRequestException('Too many preset amounts');
    const amounts=values.map((v:unknown)=>amount(v,cap));
    if(new Set(amounts).size!==amounts.length)
      throw new BadRequestException('Duplicate preset amounts');
    return amounts;
  };
  const fixedAmount=raw.fixedAmount===true;
  const allowCustomAmount=raw.allowCustomAmount===true;
  const presetAmounts=preset(raw.presetAmounts??[],8,1000000);
  const allowTips=raw.allowTips===true;
  const tipPresets=preset(raw.tipPresets??[],8,100000);
  if(!fixedAmount&&!allowCustomAmount&&presetAmounts.length===0)
    throw new BadRequestException('Choose a preset amount or enable custom amounts');
  const confirmationMessage=String(raw.confirmationMessage??'Thank you for your payment!').trim().slice(0,1000);
  const projectType=String(raw.projectType??'other').trim().toLowerCase();
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(projectType))
    throw new BadRequestException('Invalid project type');
  const projectStage=String(raw.projectStage??'booked').trim().toLowerCase();
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(projectStage))
    throw new BadRequestException('Invalid project stage');
  return {
    slug,siteSlug,coverImageUrl,fixedAmount,allowCustomAmount,presetAmounts,allowTips,tipPresets,
    confirmationMessage,createProject:raw.createProject!==false,projectType,projectStage,
    notes:String(raw.notes??'').trim().slice(0,2000),
  };
}
export function paymentLinkAmounts(config:PaymentLinkConfig,storedAmount:number,rawAmount:unknown,rawTip:unknown){
  const base=amount(rawAmount,1000000);
  if(config.fixedAmount&&Math.round(base*100)!==Math.round(storedAmount*100))
    throw new BadRequestException('This link has a fixed amount');
  if(!config.fixedAmount&&!config.allowCustomAmount&&!config.presetAmounts.some(p=>Math.round(p*100)===Math.round(base*100)))
    throw new BadRequestException('Choose a preset amount');
  const tip=rawTip==null||rawTip===''?0:Number(rawTip);
  if(!Number.isFinite(tip)||tip<0||tip>100000||Math.abs(Math.round(tip*100)-tip*100)>0.000001)
    throw new BadRequestException('Invalid tip amount');
  if(!config.allowTips&&tip!==0)throw new BadRequestException('Tips are not enabled for this link');
  if(base+tip>1000000)throw new BadRequestException('Total payment amount is too high');
  return {amount:base,tip,total:Math.round((base+tip)*100)/100};
}
