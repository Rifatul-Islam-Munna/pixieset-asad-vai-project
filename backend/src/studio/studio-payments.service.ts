import {
  BadRequestException, GoneException, Injectable, NotFoundException, Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import {
  createPayPalOrder, getPayPalOrder, capturePayPalOrder,
  paypalCaptureCompleted, paypalAccessToken, type PayPalConfig,
} from '../lib/paypal';
import { StoreSetting, StoreSettingDocument } from '../store/entities/store-setting.entity';
import {Homepage,HomepageDocument} from '../homepage/entities/homepage.entity';
import {studioPublicRootDomain} from './studio-public-domain';
import { StudioRecord, StudioRecordDocument } from './studio-record.entity';

type PaymentProvider = 'stripe' | 'paypal';
type Keys = {
  stripe: {enabled:boolean;publishableKey:string;secretKey:string;accountLink:string};
  paypal: PayPalConfig;
};
const currencies = new Set(['EUR','USD','GBP','SGD']);
const referencePattern = /^[a-zA-Z0-9_-]{7,200}$/;
const publicToken = /^[a-f0-9]{64}$/i;
const text = (value:unknown,max=300)=>String(value??'').trim().slice(0,max);

@Injectable()
export class StudioPaymentsService {
  constructor(
    @InjectModel(StoreSetting.name) private readonly storeSettings:Model<StoreSettingDocument>,
    @InjectModel(StudioRecord.name) private readonly records:Model<StudioRecordDocument>,
    @Optional() @InjectModel(Homepage.name) private readonly homepages?:Model<HomepageDocument>,
  ) {}

  private keys(settings:StoreSettingDocument|null|Record<string,any>):Keys {
    const stripe=settings?.paymentMethods?.stripe;
    const paypal=settings?.paymentMethods?.paypal;
    return {
      stripe:{
        enabled:stripe?.enabled===true,
        publishableKey:text(stripe?.publishableKey,250),
        secretKey:text(stripe?.secretKey,300),
        accountLink:text(stripe?.accountLink,500),
      },
      paypal:{
        enabled:paypal?.enabled===true,
        environment:paypal?.environment==='live'?'live':'sandbox',
        clientId:text(paypal?.clientId,250),
        clientSecret:text(paypal?.clientSecret,300),
        webhookId:text(paypal?.webhookId,250),
      },
    };
  }
  async ownerGateway(userId:string):Promise<Keys>{
    return this.keys(await this.storeSettings.findOne({userId}).lean());
  }
  private readiness(keys:Keys) {
    return {
      stripe:{
        enabled:keys.stripe.enabled,
        ready:Boolean(keys.stripe.enabled&&keys.stripe.publishableKey&&keys.stripe.secretKey),
        publishableKey:keys.stripe.publishableKey,
        hasSecret:!!keys.stripe.secretKey,
        mode:keys.stripe.secretKey.startsWith('sk_live_')?'live':keys.stripe.secretKey.startsWith('sk_test_')?'test':null,
      },
      paypal:{
        enabled:keys.paypal.enabled,
        ready:Boolean(keys.paypal.enabled&&keys.paypal.clientId&&keys.paypal.clientSecret),
        clientId:keys.paypal.clientId,
        hasSecret:!!keys.paypal.clientSecret,
        environment:keys.paypal.environment,
        hasWebhookId:!!keys.paypal.webhookId,
      },
      currency:'EUR' as const,
      sharedWithStore:true as const,
    };
  }
  async settings(userId:string){
    const current=await this.storeSettings.findOne({userId}).lean();
    return this.readiness(this.keys(current));
  }
  async updateSettings(userId:string,body:Record<string,unknown>){
    const allowed=new Set(['stripe','paypal']);
    for(const key of Object.keys(body))
      if(!allowed.has(key))throw new BadRequestException('Only Stripe or PayPal settings can be changed here');
    const current=await this.storeSettings.findOne({userId}).lean();
    const config=this.keys(current);
    const input=(key:PaymentProvider)=>{
      const value=body[key];
      if(value===undefined)return {} as Record<string,unknown>;
      if(!value||typeof value!=='object'||Array.isArray(value))
        throw new BadRequestException('Invalid '+key+' settings');
      return value as Record<string,unknown>;
    };
    const stripe=input('stripe');
    const paypal=input('paypal');
    if(stripe.enabled!==undefined)config.stripe.enabled=stripe.enabled===true;
    if(stripe.publishableKey!==undefined)config.stripe.publishableKey=text(stripe.publishableKey,250);
    if(stripe.secretKey!==undefined && text(stripe.secretKey)!=='')
      config.stripe.secretKey=text(stripe.secretKey,300);
    if(paypal.enabled!==undefined)config.paypal.enabled=paypal.enabled===true;
    if(paypal.environment!==undefined){
      if(!['sandbox','live'].includes(String(paypal.environment)))
        throw new BadRequestException('Choose PayPal sandbox or live');
      config.paypal.environment=paypal.environment as 'sandbox'|'live';
    }
    if(paypal.clientId!==undefined)config.paypal.clientId=text(paypal.clientId,250);
    if(paypal.clientSecret!==undefined&&text(paypal.clientSecret)!=='')
      config.paypal.clientSecret=text(paypal.clientSecret,300);
    if(paypal.webhookId!==undefined)config.paypal.webhookId=text(paypal.webhookId,250);

    if(config.stripe.enabled){
      if(!/^pk_(test|live)_[A-Za-z0-9]+$/.test(config.stripe.publishableKey) ||
         !/^sk_(test|live)_[A-Za-z0-9]+$/.test(config.stripe.secretKey))
        throw new BadRequestException('Valid Stripe publishable and secret keys are required');
      if(config.stripe.publishableKey.split('_')[1]!==config.stripe.secretKey.split('_')[1])
        throw new BadRequestException('Stripe test and live keys cannot be mixed');
    }
    if(config.paypal.enabled&&(!config.paypal.clientId||!config.paypal.clientSecret))
      throw new BadRequestException('PayPal client ID and secret are required');
    // Only paymentMethods is written: preserve Store currency, catalog and shipping settings.
    const settings=await this.storeSettings.findOneAndUpdate({userId},{
      $set:{
        'paymentMethods.stripe':config.stripe,
        'paymentMethods.paypal':config.paypal,
      },
      $setOnInsert:{userId,currency:'EUR',globalStatus:false},
    },{upsert:true,returnDocument:'after',setDefaultsOnInsert:true});
    return this.readiness(this.keys(settings));
  }
  async testPayPal(userId:string){
    const settings=await this.storeSettings.findOne({userId}).lean();
    const keys=this.keys(settings);
    if(!keys.paypal.enabled||!keys.paypal.clientId||!keys.paypal.clientSecret)
      throw new BadRequestException('Connect PayPal credentials first');
    await paypalAccessToken(keys.paypal);
    return {success:true,environment:keys.paypal.environment};
  }
  private async invoice(token:string){
    if(!publicToken.test(token))throw new NotFoundException('Invoice not found');
    const invoice=await this.records.findOne({kind:'invoices',token}).lean();
    if(!invoice)throw new NotFoundException('Invoice not found');
    return invoice;
  }
  private payable(invoice:StudioRecord) {
    if(invoice.status!=='sent')throw new GoneException('Invoice is not available for online checkout');
    if(!Number.isFinite(invoice.amount)||invoice.amount<=0)
      throw new BadRequestException('Invoice has no payable balance');
    if(!currencies.has(invoice.currency))
      throw new BadRequestException('Online payment is not enabled for this invoice currency');
    if(invoice.amount>100000000)
      throw new BadRequestException('Invoice amount exceeds the supported checkout limit');
  }
  async methods(token:string){
    const invoice=await this.invoice(token);
    if(invoice.status!=='sent'||invoice.amount<=0||!currencies.has(invoice.currency))
      return {stripe:false,paypal:false};
    const settings=await this.storeSettings.findOne({userId:invoice.userId}).lean();
    const readiness=this.readiness(this.keys(settings));
    return {stripe:readiness.stripe.ready,paypal:readiness.paypal.ready};
  }
  private async frontendInvoice(token:string,userId:string){
    const root=process.env.FRONTEND_URL||
      (process.env.NODE_ENV==='production'?'https://gallerista.app':'http://localhost:3000');
    let base=root;
    let localRoute='/studio/invoice/'+encodeURIComponent(token);
    if(this.homepages){
      const site=await this.homepages.findOne({userId}).lean();
      const slug=site?.slug&&site.enabled?site.slug:
        site?.subdomains?.find(s=>s.enabled)?.slug;
      const domain=studioPublicRootDomain();
      if(slug&&/^[a-z0-9-]{1,60}$/.test(slug)&&
        /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain))
        base='https://'+slug+'.'+domain;
      else if(slug&&domain==='localhost'&&process.env.NODE_ENV!=='production')
        localRoute='/studio/site/'+encodeURIComponent(slug)+'/invoice/'+encodeURIComponent(token);
    }
    const url=new URL(localRoute,base);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)
      throw new BadRequestException('Frontend URL is misconfigured');
    return url.toString();
  }
  async startCheckout(token:string,provider:PaymentProvider){
    if(provider!=='stripe'&&provider!=='paypal')
      throw new BadRequestException('Unsupported payment provider');
    const invoice=await this.invoice(token);
    this.payable(invoice);
    const config=this.keys(await this.storeSettings.findOne({userId:invoice.userId}).lean());
    const ref=String(invoice._id);
    const origin=await this.frontendInvoice(token,invoice.userId);
    if(provider==='stripe'){
      if(!this.readiness(config).stripe.ready)
        throw new BadRequestException('Stripe is not connected for this studio');
      const stripe=new Stripe(config.stripe.secretKey);
      const total=Math.round(invoice.amount*100);
      const session=await stripe.checkout.sessions.create({
        mode:'payment',
        payment_method_types:['card'],
        client_reference_id:ref,
        customer_email:invoice.email||undefined,
        line_items:[{
          quantity:1,
          price_data:{
            currency:invoice.currency.toLowerCase(),
            unit_amount:total,
            product_data:{name:'Studio Invoice '+(text(invoice.details?.number,80)||ref)},
          },
        }],
        metadata:{studioInvoiceId:ref,ownerUserId:invoice.userId},
        payment_intent_data:{metadata:{studioInvoiceId:ref,ownerUserId:invoice.userId}},
        success_url:origin+'?studio_checkout=stripe&session_id={CHECKOUT_SESSION_ID}',
        cancel_url:origin+'?studio_checkout=cancelled',
      },{idempotencyKey:'studio-'+ref+'-'+Math.floor(Date.now()/60000)});
      if(!session.url)throw new BadRequestException('Stripe did not return a checkout link');
      return {provider,url:session.url};
    }
    if(!this.readiness(config).paypal.ready)
      throw new BadRequestException('PayPal is not connected for this studio');
    const nonce=randomBytes(5).toString('hex');
    const order=await createPayPalOrder(config.paypal,{
      amount:invoice.amount,
      currency:invoice.currency,
      description:'Studio invoice '+(text(invoice.details?.number,80)||ref),
      customId:'studio:'+ref,
      invoiceId:'STUDIO-'+ref+'-'+nonce,
      returnUrl:origin+'?studio_checkout=paypal',
      cancelUrl:origin+'?studio_checkout=cancelled',
    });
    const id=text(order.order?.id,200);
    if(!referencePattern.test(id))throw new BadRequestException('PayPal did not return a valid order ID');
    const changed=await this.records.updateOne({
      _id:invoice._id,userId:invoice.userId,kind:'invoices',status:'sent',
    },{$set:{'details.onlineCheckout.paypalOrderId':id}});
    if(!changed.modifiedCount)throw new GoneException('Invoice is no longer payable');
    return {provider,url:order.approveUrl};
  }
  async verifyPayment(token:string,provider:PaymentProvider,referenceId:string){
    if(provider!=='stripe'&&provider!=='paypal')
      throw new BadRequestException('Unsupported payment provider');
    if(!referencePattern.test(referenceId))
      throw new BadRequestException('Invalid checkout reference');
    const invoice=await this.invoice(token);
    if(invoice.status!=='sent'&&invoice.status!=='paid')
      throw new GoneException('Invoice is no longer available for payment');
    const config=this.keys(await this.storeSettings.findOne({userId:invoice.userId}).lean());
    const id=String(invoice._id);
    let paymentId=referenceId;
    const expectedAmount=Math.round(invoice.amount*100);
    if(provider==='stripe'){
      if(!config.stripe.secretKey)throw new BadRequestException('Stripe connection is unavailable');
      const session=await new Stripe(config.stripe.secretKey).checkout.sessions.retrieve(referenceId);
      if(session.mode!=='payment'||session.payment_status!=='paid'||session.status!=='complete')
        throw new BadRequestException('Stripe checkout is not yet paid');
      if(session.metadata?.studioInvoiceId!==id||session.metadata?.ownerUserId!==invoice.userId||
         session.client_reference_id!==id||session.amount_total!==expectedAmount||
         session.currency?.toUpperCase()!==invoice.currency)
        throw new BadRequestException('Stripe payment does not match this invoice');
      paymentId=String(session.payment_intent||session.id);
    }else{
      const savedId=(invoice.details?.onlineCheckout as {paypalOrderId?:string}|undefined)?.paypalOrderId;
      if(savedId!==referenceId)throw new BadRequestException('PayPal order does not match this invoice');
      if(!config.paypal.clientId||!config.paypal.clientSecret)
        throw new BadRequestException('PayPal connection is unavailable');
      let order=await getPayPalOrder(config.paypal,referenceId);
      const unit=order?.purchase_units?.[0];
      const amount=unit?.amount;
      if(unit?.custom_id!=='studio:'+id||
        amount?.currency_code!==invoice.currency||
        Math.round(Number(amount?.value||0)*100)!==expectedAmount)
        throw new BadRequestException('PayPal order details do not match this invoice');
      if(!paypalCaptureCompleted(order)){
        if(order?.status!=='APPROVED')throw new BadRequestException('PayPal checkout is not approved');
        order=await capturePayPalOrder(config.paypal,referenceId);
      }
      if(!paypalCaptureCompleted(order))throw new BadRequestException('PayPal payment is not completed');
      const capture=order.purchase_units?.[0]?.payments?.captures?.find((x:any)=>x.status==='COMPLETED');
      if(!capture||capture.amount?.currency_code!==invoice.currency||
        Math.round(Number(capture.amount?.value||0)*100)!==expectedAmount)
        throw new BadRequestException('PayPal capture does not match the invoice amount');
      paymentId=String(capture.id||referenceId);
    }
    if(invoice.status==='paid'){
      const previous=invoice.details?.onlinePayment as {provider?:string;paymentId?:string}|undefined;
      if(previous?.provider===provider&&previous?.paymentId===paymentId)
        return {paid:true,alreadyPaid:true};
      throw new BadRequestException('Invoice was already marked paid by a different payment');
    }
    const paidAt=new Date().toISOString();
    const recorded=await this.records.findOneAndUpdate({
      _id:invoice._id,userId:invoice.userId,kind:'invoices',status:'sent',
    },{$set:{
      status:'paid','details.onlinePayment':{provider,paymentId,referenceId,paidAt},
      'details.paidAt':paidAt,'details.paymentMethod':provider,
    }},{returnDocument:'after'}).lean();
    if(!recorded){
      const latest=await this.records.findOne({_id:invoice._id,kind:'invoices'}).lean();
      if(latest?.status==='paid'&&
        (latest.details?.onlinePayment as {paymentId?:string}|undefined)?.paymentId===paymentId)
        return {paid:true,alreadyPaid:true};
      throw new GoneException('This invoice changed while the payment was being verified');
    }
    // A successful external charge must never be rolled back if transaction recording fails.
    // The verified paid invoice remains the source of truth for reconciliation.
    await this.records.findOneAndUpdate({
      userId:invoice.userId,kind:'transactions',
      'details.onlinePaymentId':provider+':'+paymentId,
    },{$setOnInsert:{
      userId:invoice.userId,kind:'transactions',
      title:'Online payment for '+invoice.title,
      status:'paid',type:provider,currency:invoice.currency,amount:invoice.amount,
      contactId:invoice.contactId,projectId:invoice.projectId,
      details:{onlinePaymentId:provider+':'+paymentId,invoiceId:id,provider,recordedAt:paidAt},
    }},{upsert:true,returnDocument:'after'}).lean();
    return {paid:true,alreadyPaid:false};
  }
}
