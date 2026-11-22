import {BadRequestException,GoneException,NotFoundException} from '@nestjs/common';
import {Types} from 'mongoose';
import {StudioPaymentLinksService} from './studio-payment-links.service';
import {createPayPalOrder,getPayPalOrder,capturePayPalOrder} from '../lib/paypal';

const stripeCreate=jest.fn();
const stripeRetrieve=jest.fn();
jest.mock('stripe',()=>({
  __esModule:true,
  default:jest.fn().mockImplementation(()=>({checkout:{sessions:{create:stripeCreate,retrieve:stripeRetrieve}}})),
}));
jest.mock('../lib/paypal',()=>({
  createPayPalOrder:jest.fn(),getPayPalOrder:jest.fn(),capturePayPalOrder:jest.fn(),
  paypalCaptureCompleted:(order:any)=>order?.status==='COMPLETED',
}));
const linkId=new Types.ObjectId('123456789012345678901234');
const transactionId=new Types.ObjectId('223456789012345678901234');
const projectId=new Types.ObjectId('323456789012345678901234');
const contactId=new Types.ObjectId('423456789012345678901234');
const token='a'.repeat(64);
const config={
  slug:'tips',siteSlug:'rifat39',fixedAmount:false,
  allowCustomAmount:true,presetAmounts:[25,50,100],
  allowTips:true,tipPresets:[5,10],createProject:true,
  projectType:'portrait',projectStage:'booked',coverImageUrl:'',
  confirmationMessage:'Thanks for supporting the studio',notes:'',
};
const link={
  _id:linkId,userId:'owner-A',kind:'payment-links',title:'Tips',
  token,status:'active',amount:0,currency:'EUR',description:'Support us',
  details:config,
};
const transaction={
  _id:transactionId,userId:'owner-A',kind:'transactions',status:'pending',
  title:'Payment: Tips',email:'jane@example.com',amount:60,currency:'EUR',type:'stripe',
  details:{
    paymentLinkId:String(linkId),checkoutReference:'cs_test_studio_link',baseAmount:50,tipAmount:10,
    firstName:'Jane',lastName:'Doe',message:'Thanks!',
    createProject:true,projectType:'portrait',projectStage:'booked',
  },
};
const paid={...transaction,status:'paid',details:{...transaction.details,paidReference:'pi_studio_paid'}};
const safeConfig={
  stripe:{enabled:true,publishableKey:'pk_test_test',secretKey:'sk_test_test',accountLink:''},
  paypal:{enabled:true,environment:'sandbox',clientId:'client-A',clientSecret:'secret-A',webhookId:''},
};
const chain=(value:any)=>({lean:jest.fn().mockResolvedValue(value)});
function fixture(settings:any=safeConfig){
  const records:any={
    findOne:jest.fn((query:any)=>{
      if(query.kind==='payment-links')
        return chain(query.userId&&query.userId!=='owner-A'?null:{...link});
      if(query.kind==='projects')return chain(null);
      if(query.kind==='contacts')return chain({_id:contactId,title:'Jane Doe',email:'jane@example.com'});
      if(query.kind==='transactions')return {...transaction};
      return chain(null);
    }),
    create:jest.fn().mockResolvedValue({_id:transactionId,...transaction}),
    updateOne:jest.fn().mockResolvedValue({modifiedCount:1}),
    findOneAndUpdate:jest.fn((filter:any,update:any)=>{
      if(filter.kind==='projects')return chain({_id:projectId});
      if(filter.kind==='transactions')return {...paid};
      return chain(null);
    }),
  };
  const homepages:any={
    findOne:jest.fn().mockReturnValue(chain({
      userId:'owner-A',slug:'rifat39',enabled:true,
      mainSiteName:'My Studio',subdomains:[{slug:'wedding',enabled:true,name:'Wedding website'}],
    })),
  };
  const payments:any={
    ownerGateway:jest.fn().mockResolvedValue(settings),
    settings:jest.fn().mockResolvedValue({
      stripe:{enabled:true,ready:true},paypal:{enabled:true,ready:true},
    }),
  };
  return {service:new StudioPaymentLinksService(records,homepages,payments),records,homepages,payments};
}
beforeEach(()=>{
  jest.clearAllMocks();
  stripeCreate.mockResolvedValue({id:'cs_test_studio_link',url:'https://checkout.stripe.com/c/pay'});
  stripeRetrieve.mockResolvedValue({
    id:'cs_test_studio_link',status:'complete',mode:'payment',payment_status:'paid',
    client_reference_id:String(transactionId),amount_total:6000,currency:'eur',
    payment_intent:'pi_studio_paid',
    metadata:{studioPaymentId:String(transactionId),ownerUserId:'owner-A',paymentLinkId:String(linkId)},
  });
  (createPayPalOrder as jest.Mock).mockResolvedValue({
    order:{id:'PAYPALSTUDIOLINK123'},approveUrl:'https://www.sandbox.paypal.com/checkout',
  });
  (getPayPalOrder as jest.Mock).mockResolvedValue({
    status:'APPROVED',purchase_units:[{
      custom_id:'studio-link:'+String(transactionId),amount:{currency_code:'EUR',value:'60.00'},
    }],
  });
  (capturePayPalOrder as jest.Mock).mockResolvedValue({
    status:'COMPLETED',purchase_units:[{
      custom_id:'studio-link:'+String(transactionId),amount:{currency_code:'EUR',value:'60.00'},
      payments:{captures:[{id:'CAPTURESTUDIO123',status:'COMPLETED',amount:{currency_code:'EUR',value:'60.00'}}]},
    }],
  });
});
describe('Public reusable Studio payment links',()=>{
  it("checks the owner's enabled subdomain before resolving a friendly URL",async()=>{
    const {service,homepages,records}=fixture();
    const data=await service.linkBySite('rifat39','tips');
    expect(data.token).toBe(token);
    expect(data.methods).toEqual({stripe:true,paypal:true});
    expect(homepages.findOne.mock.calls[0][0]).toEqual({
      $or:[{slug:'rifat39',enabled:true},{subdomains:{$elemMatch:{slug:'rifat39',enabled:true}}}],
    });
    expect(records.findOne.mock.calls[0][0]).toMatchObject({
      userId:'owner-A',kind:'payment-links',status:{$ne:'draft'},
      'details.slug':'tips','details.siteSlug':'rifat39',
    });
  });
  it('never discloses payment processor credentials on public page',async()=>{
    const {service}=fixture();
    const data=await service.publicLink(token);
    expect(JSON.stringify(data)).not.toContain('sk_test_test');
    expect(JSON.stringify(data)).not.toContain('secret-A');
  });
  it('rejects disabled payment links',async()=>{
    const {service,records}=fixture();
    records.findOne.mockReturnValueOnce(chain({...link,status:'draft'}));
    await expect(service.publicLink(token)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('allows a previously cancelled link to show a receipt without starting new checkouts',async()=>{
    const {service,records}=fixture();
    records.findOne.mockReturnValueOnce(chain({...link,status:'cancelled'}));
    const result=await service.publicLink(token);
    expect(result.onlinePaymentEnabled).toBe(false);
    expect(result.methods).toEqual({stripe:false,paypal:false});
  });
  it('rejects a website that does not own the requested link',async()=>{
    const {service,homepages}=fixture();
    homepages.findOne.mockReturnValueOnce(chain({userId:'other-owner'}));
    await expect(service.linkBySite('rifat39','tips')).rejects.toBeInstanceOf(NotFoundException);
  });
});
describe('Reusable checkout and automatic CRM/project creation',()=>{
  it('creates a pending transaction using entered customer data, then opens Stripe',async()=>{
    const {service,records}=fixture();
    const result=await service.checkout(token,{
      provider:'stripe',amount:50,tip:10,
      firstName:'Jane',lastName:'Doe',email:'jane@example.com',message:'Thanks!',
    });
    expect(result.provider).toBe('stripe');
    expect(result.url).toContain('checkout.stripe.com');
    expect(records.create).toHaveBeenCalledWith(expect.objectContaining({
      kind:'transactions',status:'pending',amount:60,currency:'EUR',email:'jane@example.com',
      details:expect.objectContaining({baseAmount:50,tipAmount:10,paymentLinkId:String(linkId)}),
    }));
    expect(stripeCreate).toHaveBeenCalledWith(expect.objectContaining({
      client_reference_id:String(transactionId),
      metadata:expect.objectContaining({ownerUserId:'owner-A',paymentLinkId:String(linkId)}),
      line_items:[expect.objectContaining({price_data:expect.objectContaining({unit_amount:5000})}),
        expect.objectContaining({price_data:expect.objectContaining({unit_amount:1000})})],
    }),expect.any(Object));
  });
  it('rejects a client-supplied amount outside configured presets',async()=>{
    const {service,records}=fixture();
    records.findOne.mockReturnValueOnce(chain({...link,details:{...config,allowCustomAmount:false}}));
    await expect(service.checkout(token,{
      provider:'stripe',amount:5000,tip:0,firstName:'Jane',lastName:'Doe',email:'jane@example.com',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(records.create).not.toHaveBeenCalled();
  });
  it('does not mark paid or create a project for an unpaid checkout',async()=>{
    const {service,records}=fixture();
    stripeRetrieve.mockResolvedValueOnce({
      status:'open',payment_status:'unpaid',metadata:{ownerUserId:'owner-A'},
    });
    await expect(service.verify(token,'stripe','cs_test_studio_link'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(records.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('refuses cross-tenant Stripe payment metadata before reading a transaction',async()=>{
    const {service,records}=fixture();
    stripeRetrieve.mockResolvedValueOnce({
      mode:'payment',status:'complete',payment_status:'paid',
      metadata:{ownerUserId:'other-owner',studioPaymentId:String(transactionId),paymentLinkId:String(linkId)},
      client_reference_id:String(transactionId),
    });
    await expect(service.verify(token,'stripe','cs_test_studio_link'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(records.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('creates exactly one project tied to the verified Stripe transaction',async()=>{
    const {service,records}=fixture();
    const result=await service.verify(token,'stripe','cs_test_studio_link');
    expect(result).toMatchObject({paid:true,alreadyPaid:false,projectId:String(projectId)});
    expect(records.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({kind:'transactions',status:'pending'}),
      {$set:expect.objectContaining({status:'paid','details.paidReference':'pi_studio_paid'})},
      expect.any(Object),
    );
    expect(records.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({kind:'projects','details.sourcePaymentId':String(transactionId)}),
      {$setOnInsert:expect.objectContaining({contactId:String(contactId),status:'booked'})},
      expect.objectContaining({upsert:true}),
    );
  });
  it('keeps already verified payments idempotent',async()=>{
    const {service,records}=fixture();
    records.findOne.mockImplementation((query:any)=>{
      if(query.kind==='payment-links')return chain({...link});
      if(query.kind==='projects')return chain({_id:projectId});
      if(query.kind==='transactions')return {...paid};
      return chain(null);
    });
    const result=await service.verify(token,'stripe','cs_test_studio_link');
    expect(result).toMatchObject({paid:true,alreadyPaid:true,projectId:String(projectId)});
    expect(records.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("opens PayPal using the owner's existing Store configuration",async()=>{
    const {service,records}=fixture();
    const result=await service.checkout(token,{
      provider:'paypal',amount:50,tip:10,
      firstName:'Jane',lastName:'Doe',email:'jane@example.com',
    });
    expect(result.provider).toBe('paypal');
    expect(createPayPalOrder).toHaveBeenCalledWith(
      expect.objectContaining({clientId:'client-A',environment:'sandbox'}),
      expect.objectContaining({currency:'EUR',amount:60,customId:'studio-link:'+String(transactionId)}),
    );
    expect(records.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({kind:'transactions',status:'pending'}),
      {$set:{'details.checkoutReference':'PAYPALSTUDIOLINK123'}},
    );
  });
  it('verifies the PayPal capture amount before creating a project',async()=>{
    const {service,records}=fixture();
    records.findOne.mockImplementation((query:any)=>{
      if(query.kind==='payment-links')return chain({...link});
      if(query.kind==='projects')return chain(null);
      if(query.kind==='contacts')return chain({_id:contactId,title:'Jane'});
      if(query.kind==='transactions')return {...transaction,type:'paypal',details:{...transaction.details,
        checkoutReference:'PAYPALSTUDIOLINK123'}};
      return chain(null);
    });
    const result=await service.verify(token,'paypal','PAYPALSTUDIOLINK123');
    expect(result.paid).toBe(true);
    expect(capturePayPalOrder).toHaveBeenCalled();
    expect(records.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({kind:'transactions',status:'pending'}),
      {$set:expect.objectContaining({status:'paid','details.paidReference':'CAPTURESTUDIO123'})},
      expect.any(Object),
    );
  });
});
