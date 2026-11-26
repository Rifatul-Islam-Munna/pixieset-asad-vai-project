import {BadRequestException, GoneException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {randomBytes} from 'node:crypto';
import {Model, Types} from 'mongoose';
import Stripe from 'stripe';
import {Homepage,HomepageDocument} from '../homepage/entities/homepage.entity';
import {createPayPalOrder,getPayPalOrder,capturePayPalOrder,paypalCaptureCompleted} from '../lib/paypal';
import {StudioRecord,StudioRecordDocument} from './studio-record.entity';
import {normalizePaymentLinkSettings,paymentLinkAmounts} from './studio-payment-link-settings';
import {StudioPaymentsService} from './studio-payments.service';
import {studioPublicRootDomain} from './studio-public-domain';
import {StudioSubscriptionService} from './studio-subscription.service';

type Provider='stripe'|'paypal';
const tokenPattern=/^[a-f0-9]{64}$/i;
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const paymentIdPattern=/^[a-zA-Z0-9_-]{7,200}$/;
const clean=(value:unknown,max=180)=>String(value??'').trim().slice(0,max);
const round=(v:number)=>Math.round(v*100);
function safeRef(value:unknown){
  const ref=clean(value,200);
  if(!paymentIdPattern.test(ref))throw new BadRequestException('Invalid payment reference');
  return ref;
}

@Injectable()
export class StudioPaymentLinksService {
  constructor(
    @InjectModel(StudioRecord.name) private readonly records:Model<StudioRecordDocument>,
    @InjectModel(Homepage.name) private readonly homepages:Model<HomepageDocument>,
    private readonly payments:StudioPaymentsService,
    private readonly subscriptions?:StudioSubscriptionService,
  ) {}

  async ownerSites(userId:string){
    const homepage=await this.homepages.findOne({userId}).lean();
    const sites=[
      ...(homepage?.slug&&homepage.enabled?[{slug:homepage.slug,name:homepage.mainSiteName||homepage.brandName||'Main website'}]:[]),
      ...((homepage?.subdomains||[]).filter(site=>site.enabled).map(site=>({slug:site.slug,name:site.name}))),
    ];
    return {sites,rootDomain:studioPublicRootDomain()};
  }

  /** Resolve a public website to its actual enabled owner, never from URL parameters. */
  async siteOwner(siteSlug:string):Promise<string>{
    if(!slugPattern.test(siteSlug))throw new NotFoundException('Studio site not found');
    const home=await this.homepages.findOne({
      $or:[{slug:siteSlug,enabled:true},{subdomains:{$elemMatch:{slug:siteSlug,enabled:true}}}],
    }).lean();
    if(!home?.userId)throw new NotFoundException('Studio site not found');
    return String(home.userId);
  }

  private async link(token:string,requiresActive=true){
    if(!tokenPattern.test(token))throw new NotFoundException('Payment link not found');
    const found=await this.records.findOne({kind:'payment-links',token}).lean();
    if(!found)throw new NotFoundException('Payment link not found');
    if(requiresActive){
      if(found.status!=='active')throw new GoneException('This payment link is not active');
      if(found.dueDate&&new Date(found.dueDate).getTime()<Date.now())
        throw new GoneException('This payment link has expired');
    }
    return found;
  }

  async linkBySite(siteSlug:string,linkSlug:string){
    if(!slugPattern.test(siteSlug)||!slugPattern.test(linkSlug))
      throw new NotFoundException('Payment link not found');
    const home=await this.homepages.findOne({
      $or:[{slug:siteSlug,enabled:true},{subdomains:{$elemMatch:{slug:siteSlug,enabled:true}}}],
    }).lean();
    if(!home)throw new NotFoundException('Studio site not found');
    const found=await this.records.findOne({
      userId:home.userId,kind:'payment-links',status:{$ne:'draft'},
      'details.slug':linkSlug,'details.siteSlug':siteSlug,
    }).lean();
    if(!found?.token)throw new NotFoundException('Payment link not found');
    return this.publicLink(found.token);
  }

  async publicLink(token:string){
    const link=await this.link(token,false);
    if(link.status==='draft')throw new NotFoundException('Payment link is not published');
    const active=link.status==='active'&&
      (!link.dueDate||new Date(link.dueDate).getTime()>=Date.now());
    const raw=link.details||{};
    const legacy=!raw.slug;
    const config=legacy?null:normalizePaymentLinkSettings(raw);
    const gateways=await this.payments.settings(link.userId);
    return {
      token, title:link.title,description:link.description,
      amount:link.amount,currency:link.currency,expiresAt:link.dueDate||null,
      ...(config||{
        slug:'',siteSlug:'',coverImageUrl:'',fixedAmount:true,allowCustomAmount:false,
        presetAmounts:[],allowTips:false,tipPresets:[],
        confirmationMessage:'Thank you for your payment!',createProject:false,
        projectType:'other',projectStage:'booked',
        notes:clean(raw.notes,2000),
      }),
      onlinePaymentEnabled:active&&!legacy&&(gateways.stripe.ready||gateways.paypal.ready),
      methods:{
        stripe:active&&!legacy&&gateways.stripe.ready&&['EUR','USD','GBP','SGD'].includes(link.currency),
        paypal:active&&!legacy&&gateways.paypal.ready&&['EUR','USD','GBP','SGD'].includes(link.currency),
      },
    };
  }

  private returnUrl(link:StudioRecord,provider:Provider) {
    const config=link.details||{};
    const root=studioPublicRootDomain();
    const sub=clean(config.siteSlug,60);
    const slug=clean(config.slug,60);
    const fallback=(process.env.FRONTEND_URL||'http://localhost:3000').replace(/\/$/,'');
    let base=fallback+'/studio/payment/'+encodeURIComponent(link.token||'');
    if(sub&&slug&&slugPattern.test(sub)&&slugPattern.test(slug)&&root!=='localhost'&&/^[a-z0-9.-]+$/i.test(root))
      base='https://'+sub+'.'+root+'/payment/'+slug;
    return base+'?studio_payment='+provider;
  }

  async checkout(token:string,body:Record<string,unknown>){
    const link=await this.link(token);
    if(!link.details?.slug)throw new BadRequestException('This payment request only supports manual payments');
    if(!['EUR','USD','GBP','SGD'].includes(link.currency))
      throw new BadRequestException('Online checkout is unavailable for this currency');
    const settings=normalizePaymentLinkSettings(link.details);
    const provider=body.provider as Provider;
    if(!['stripe','paypal'].includes(provider))
      throw new BadRequestException('Choose Stripe or PayPal');
    const firstName=clean(body.firstName,100);
    const lastName=clean(body.lastName,100);
    const email=clean(body.email,200).toLowerCase();
    const message=clean(body.message,1000);
    if(!firstName||!lastName||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('Enter your first name, last name and a valid email');
    const {amount,tip,total}=paymentLinkAmounts(settings,link.amount,body.amount,body.tip);
    const gateway=await this.payments.ownerGateway(link.userId);
    if(provider==='stripe'&&(!gateway.stripe.enabled||!gateway.stripe.secretKey||!gateway.stripe.publishableKey))
      throw new BadRequestException('Stripe is not connected for this studio');
    if(provider==='paypal'&&(!gateway.paypal.enabled||!gateway.paypal.clientId||!gateway.paypal.clientSecret))
      throw new BadRequestException('PayPal is not connected for this studio');

    const attempt=await this.records.create({
      userId:link.userId,kind:'transactions',type:provider,status:'pending',
      title:'Payment: '+link.title,amount:total,currency:link.currency,email,
      details:{paymentLinkId:String(link._id),firstName,lastName,message,
        baseAmount:amount,tipAmount:tip,provider,createProject:settings.createProject,
        projectType:settings.projectType,projectStage:settings.projectStage},
    });
    const id=String(attempt._id);
    const siteUrl=this.returnUrl(link,provider);
    try{
      let redirectUrl='';
      let checkoutReference='';
      if(provider==='stripe'){
        const session=await new Stripe(gateway.stripe.secretKey).checkout.sessions.create({
          mode:'payment',payment_method_types:['card'],
          client_reference_id:id,customer_email:email,
          line_items:[
            {quantity:1,price_data:{currency:link.currency.toLowerCase(),unit_amount:round(amount),
              product_data:{name:link.title.slice(0,120)}}},
            ...(tip>0?[{quantity:1,price_data:{currency:link.currency.toLowerCase(),unit_amount:round(tip),
              product_data:{name:'Tip'}}}]:[]),
          ],
          payment_intent_data:{metadata:{studioPaymentId:id,ownerUserId:link.userId,paymentLinkId:String(link._id)}},
          metadata:{studioPaymentId:id,ownerUserId:link.userId,paymentLinkId:String(link._id)},
          success_url:siteUrl+'&session_id={CHECKOUT_SESSION_ID}',
          cancel_url:siteUrl.replace('studio_payment=stripe','studio_payment=cancelled'),
        },{idempotencyKey:'studio-payment-link-'+id});
        redirectUrl=String(session.url||'');
        checkoutReference=String(session.id);
      }else{
        const payment=await createPayPalOrder(gateway.paypal,{
          amount:total,currency:link.currency,description:link.title.slice(0,125),
          customId:'studio-link:'+id,
          invoiceId:'STUDIO-LINK-'+id+'-'+randomBytes(4).toString('hex'),
          returnUrl:siteUrl,
          cancelUrl:siteUrl.replace('studio_payment=paypal','studio_payment=cancelled'),
        });
        redirectUrl=payment.approveUrl;
        checkoutReference=String(payment.order?.id||'');
      }
      if(!redirectUrl||!checkoutReference)
        throw new BadRequestException('The payment provider did not return a checkout link');
      await this.records.updateOne(
        {_id:attempt._id,userId:link.userId,kind:'transactions',status:'pending'},
        {$set:{'details.checkoutReference':checkoutReference}},
      );
      return {provider,url:redirectUrl};
    }catch(error){
      await this.records.updateOne({_id:attempt._id,status:'pending'},{$set:{status:'cancelled'}}).catch(()=>undefined);
      throw error;
    }
  }

  private async fulfill(
    transaction:StudioRecord&{_id:Types.ObjectId},
    link:StudioRecord&{_id:Types.ObjectId},
  ){
    const info=transaction.details||{};
    if(info.createProject!==true)return {projectId:null};
    const paymentId=String(transaction._id);
    let project=await this.records.findOne({userId:link.userId,kind:'projects','details.sourcePaymentId':paymentId}).lean();
    if(project)return {projectId:String(project._id)};
    const email=clean(transaction.email,200).toLowerCase();
    const fullName=[clean(info.firstName,100),clean(info.lastName,100)].filter(Boolean).join(' ');
    const getContact=async()=>{
    let contact=await this.records.findOne({userId:link.userId,kind:'contacts',email}).lean();
    if(!contact){
      try{
        await this.subscriptions?.assertRecord(link.userId,'contacts');
        contact=await this.records.create({
          userId:link.userId,kind:'contacts',title:fullName,email,status:'client',type:'client',
          details:{sourcePaymentId:paymentId,source:'studio-payment-link'},
        });
      }catch(error){
        contact=await this.records.findOne({userId:link.userId,kind:'contacts',email}).lean();
        if(!contact)throw error;
      }
    }
    return contact;
    };
    const contact=this.subscriptions?await this.subscriptions.withRecordLock(link.userId,getContact):await getContact();
    const source={
      userId:link.userId,kind:'projects' as const,'details.sourcePaymentId':paymentId,
    };
    // The unique partial index on sourcePaymentId prevents two projects for one charge.
    const createProject=async()=>{
      const existing=await this.records.findOne(source).lean();
      if(existing)return existing;
      await this.subscriptions?.assertRecord(link.userId,'projects');
      return this.records.findOneAndUpdate(source,{$setOnInsert:{
      userId:link.userId,kind:'projects',title:link.title+' — '+fullName,
      contactId:String(contact._id),type:clean(info.projectType,40)||'other',
      status:clean(info.projectStage,40)||'booked',currency:transaction.currency,
      email,description:clean(info.message,1000),
      details:{sourcePaymentId:paymentId,paymentLinkId:String(link._id),location:''},
    }},{upsert:true,returnDocument:'after'}).lean();
    };
    project=this.subscriptions?await this.subscriptions.withRecordLock(link.userId,createProject):await createProject();
    await this.records.updateOne(
      {_id:transaction._id,userId:link.userId,kind:'transactions',status:'paid'},
      {$set:{projectId:String(project!._id),contactId:String(contact._id),
        'details.projectId':String(project!._id)}},
    );
    return {projectId:String(project!._id)};
  }

  private async fulfillSafely(transaction:StudioRecord&{_id:Types.ObjectId},link:StudioRecord&{_id:Types.ObjectId}){
    try{return await this.fulfill(transaction,link);}
    catch(error){
      // A successful payment must remain paid even if the studio has no remaining CRM quota.
      await this.records.updateOne({_id:transaction._id,userId:link.userId,kind:'transactions',status:'paid'},{$set:{'details.projectCreationError':error instanceof Error?error.message:'CRM sync failed'}}).catch(()=>undefined);
      return {projectId:null};
    }
  }

  async verify(token:string,provider:Provider,referenceId:string){
    const link=await this.link(token,false);
    if(!['stripe','paypal'].includes(provider))
      throw new BadRequestException('Unsupported provider');
    referenceId=safeRef(referenceId);
    const gateway=await this.payments.ownerGateway(link.userId);
    let transaction:StudioRecordDocument|null=null;
    let paymentId='';
    let currency='';
    let amount=0;
    if(provider==='stripe'){
      if(!gateway.stripe.secretKey)throw new BadRequestException('Stripe is not configured');
      const session=await new Stripe(gateway.stripe.secretKey).checkout.sessions.retrieve(referenceId);
      if(session.mode!=='payment'||session.payment_status!=='paid'||session.status!=='complete')
        throw new BadRequestException('Stripe checkout is not paid');
      const attemptId=String(session.metadata?.studioPaymentId||'');
      if(!Types.ObjectId.isValid(attemptId)||session.client_reference_id!==attemptId||
        session.metadata?.ownerUserId!==link.userId||
        session.metadata?.paymentLinkId!==String(link._id))
        throw new BadRequestException('Payment does not belong to this studio link');
      transaction=await this.records.findOne({
        _id:attemptId,userId:link.userId,kind:'transactions','details.paymentLinkId':String(link._id),
      });
      if(!transaction||transaction.type!=='stripe'||transaction.details?.checkoutReference!==referenceId)
        throw new BadRequestException('Checkout reference mismatch');
      paymentId=String(session.payment_intent||session.id);
      currency=String(session.currency||'').toUpperCase();
      amount=Number(session.amount_total||0);
    }else{
      transaction=await this.records.findOne({
        userId:link.userId,kind:'transactions','details.paymentLinkId':String(link._id),
        'details.checkoutReference':referenceId,
      });
      if(!transaction||transaction.type!=='paypal')
        throw new BadRequestException('PayPal order was not created for this link');
      if(!gateway.paypal.clientId||!gateway.paypal.clientSecret)
        throw new BadRequestException('PayPal connection is unavailable');
      let order=await getPayPalOrder(gateway.paypal,referenceId);
      const unit=order.purchase_units?.[0];
      if(unit?.custom_id!=='studio-link:'+String(transaction._id)||
        String(unit.amount?.currency_code||'').toUpperCase()!==transaction.currency||
        round(Number(unit.amount?.value))!==round(transaction.amount))
        throw new BadRequestException('PayPal order does not match payment');
      if(!paypalCaptureCompleted(order)){
        if(order.status!=='APPROVED')throw new BadRequestException('PayPal payment not approved');
        order=await capturePayPalOrder(gateway.paypal,referenceId);
      }
      if(!paypalCaptureCompleted(order))throw new BadRequestException('PayPal payment not captured');
      const capture=order.purchase_units?.[0]?.payments?.captures?.find((c:any)=>c.status==='COMPLETED');
      if(!capture||String(capture.amount?.currency_code||'').toUpperCase()!==transaction.currency||
        round(Number(capture.amount?.value))!==round(transaction.amount))
        throw new BadRequestException('PayPal capture amount mismatch');
      paymentId=String(capture.id||referenceId);
      currency=transaction.currency;
      amount=round(transaction.amount);
    }
    if(!transaction)throw new NotFoundException('Payment attempt not found');
    if(currency!==transaction.currency||amount!==round(transaction.amount))
      throw new BadRequestException('Payment amount or currency differs from checkout');
    if(transaction.status==='paid'){
      if(transaction.details?.paidReference!==paymentId)
        throw new BadRequestException('A different payment is already recorded');
      return {paid:true,alreadyPaid:true,...await this.fulfillSafely(transaction,link),
        confirmationMessage:clean(link.details?.confirmationMessage,1000)||'Thank you for your payment!'};
    }
    if(transaction.status!=='pending')throw new GoneException('Payment attempt is not payable');
    const paid=await this.records.findOneAndUpdate({
      _id:transaction._id,userId:link.userId,kind:'transactions',status:'pending',
    },{$set:{status:'paid','details.paidReference':paymentId,'details.paidAt':new Date().toISOString()}},
    {returnDocument:'after'});
    if(!paid){
      const current=await this.records.findOne({_id:transaction._id,kind:'transactions'});
      if(current?.status==='paid'&&current.details?.paidReference===paymentId)
        return {paid:true,alreadyPaid:true,...await this.fulfillSafely(current,link),
          confirmationMessage:clean(link.details?.confirmationMessage,1000)||'Thank you for your payment!'};
      throw new GoneException('Payment state changed during verification');
    }
    return {paid:true,alreadyPaid:false,...await this.fulfillSafely(paid,link),
      confirmationMessage:clean(link.details?.confirmationMessage,1000)||'Thank you for your payment!'};
  }
}
