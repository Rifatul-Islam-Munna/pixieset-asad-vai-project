import { BadRequestException, GoneException } from '@nestjs/common';
import { StudioPaymentsService } from './studio-payments.service';
import {
  createPayPalOrder, getPayPalOrder, capturePayPalOrder, paypalAccessToken,
} from '../lib/paypal';

const stripeCreate = jest.fn();
const stripeRetrieve = jest.fn();
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: stripeCreate, retrieve: stripeRetrieve } },
  })),
}));
jest.mock('../lib/paypal', () => ({
  createPayPalOrder: jest.fn(),
  getPayPalOrder: jest.fn(),
  capturePayPalOrder: jest.fn(),
  paypalCaptureCompleted: (order:any) => order?.status === 'COMPLETED',
  paypalAccessToken: jest.fn(),
}));

const id='123456789012345678901234';
const token='a'.repeat(64);
const store={
  userId:'owner-A',currency:'EUR',globalStatus:true,
  paymentMethods:{
    stripe:{enabled:true,publishableKey:'pk_test_valid123456',secretKey:'sk_test_valid123456',accountLink:''},
    paypal:{enabled:true,environment:'sandbox',clientId:'paypal-client',clientSecret:'paypal-secret',webhookId:''},
  },
  links:[{label:'Store website',url:'https://example.com'}],
};
const invoice={
  _id:id,userId:'owner-A',kind:'invoices',token,status:'sent',
  title:'Portrait',amount:250,currency:'EUR',email:'jane@example.com',
  details:{number:'INV-010',onlineCheckout:{paypalOrderId:'PAYPALORDER123'}},
  contactId:'a'.repeat(24),projectId:'b'.repeat(24),
};
const q=(value:any)=>({lean:jest.fn().mockResolvedValue(value)});

function fixture(status='sent'){
  const model:any={
    findOne:jest.fn().mockReturnValue(q({...invoice,status})),
    findOneAndUpdate:jest.fn()
      .mockReturnValueOnce(q({...invoice,status:'paid'}))
      .mockReturnValueOnce(q({kind:'transactions'})),
    updateOne:jest.fn().mockResolvedValue({modifiedCount:1}),
  };
  const settingModel:any={
    findOne:jest.fn().mockReturnValue(q(store)),
    findOneAndUpdate:jest.fn().mockResolvedValue({...store}),
  };
  const service=new StudioPaymentsService(settingModel as any,model as any);
  return {service,model,settingModel};
}
beforeEach(()=>{
  jest.clearAllMocks();
  stripeCreate.mockResolvedValue({id:'cs_test_valid_session',url:'https://checkout.stripe.com/pay/sample'});
  stripeRetrieve.mockResolvedValue({
    id:'cs_test_valid_session',mode:'payment',payment_status:'paid',status:'complete',
    client_reference_id:id,currency:'eur',amount_total:25000,payment_intent:'pi_test_paid',
    metadata:{studioInvoiceId:id,ownerUserId:'owner-A'},
  });
  (createPayPalOrder as jest.Mock).mockResolvedValue({
    order:{id:'PAYPALORDER123'},approveUrl:'https://www.sandbox.paypal.com/checkoutnow?token=PAYPALORDER123',
  });
  (getPayPalOrder as jest.Mock).mockResolvedValue({
    status:'APPROVED',purchase_units:[{custom_id:'studio:'+id,
      amount:{currency_code:'EUR',value:'250.00'}}],
  });
  (capturePayPalOrder as jest.Mock).mockResolvedValue({
    status:'COMPLETED',purchase_units:[{custom_id:'studio:'+id,amount:{currency_code:'EUR',value:'250.00'},
      payments:{captures:[{id:'CAPTURE123',status:'COMPLETED',amount:{currency_code:'EUR',value:'250.00'}}]}}],
  });
  (paypalAccessToken as jest.Mock).mockResolvedValue('test-oauth-token');
});

describe('Store / Studio shared payment configuration',()=>{
  it('reads Store payment credentials without leaking either private key',async()=>{
    const {service,settingModel}=fixture();
    const value=await service.settings('owner-A');
    expect(settingModel.findOne).toHaveBeenCalledWith({userId:'owner-A'});
    expect(value.sharedWithStore).toBe(true);
    expect(value.stripe.ready).toBe(true);
    expect(value.paypal.ready).toBe(true);
    expect(value.stripe).not.toHaveProperty('secretKey');
    expect(value.paypal).not.toHaveProperty('clientSecret');
    expect(JSON.stringify(value)).not.toContain('sk_test_valid123456');
  });
  it('only updates shared paymentMethods, preserving Store and catalog settings',async()=>{
    const {service,settingModel}=fixture();
    await service.updateSettings('owner-A',{
      stripe:{enabled:true,publishableKey:store.paymentMethods.stripe.publishableKey},
      paypal:{enabled:true,environment:'sandbox',clientId:store.paymentMethods.paypal.clientId},
    });
    const query=settingModel.findOneAndUpdate.mock.calls[0][1];
    expect(query.$set).toMatchObject({
      'paymentMethods.stripe':expect.objectContaining({secretKey:'sk_test_valid123456'}),
      'paymentMethods.paypal':expect.objectContaining({clientSecret:'paypal-secret'}),
    });
    expect(query.$set).not.toHaveProperty('currency');
    expect(query.$set).not.toHaveProperty('links');
    expect(query.$set).not.toHaveProperty('globalStatus');
  });
  it('refuses mixed test and live Stripe keys',async()=>{
    const {service,settingModel}=fixture();
    await expect(service.updateSettings('owner-A',{
      stripe:{enabled:true,publishableKey:'pk_live_differentkey'},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(settingModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('validates PayPal with the same owner account',async()=>{
    const {service}=fixture();
    expect(await service.testPayPal('owner-A')).toEqual({success:true,environment:'sandbox'});
    expect(paypalAccessToken).toHaveBeenCalledWith(expect.objectContaining({clientId:'paypal-client'}));
  });
});

describe('Online invoice checkout ownership and settlement',()=>{
  it('offers both gateways on a EUR invoice sent to the client',async()=>{
    const {service}=fixture();
    expect(await service.methods(token)).toEqual({stripe:true,paypal:true});
  });
  it('does not allow a draft invoice to enter online checkout',async()=>{
    const {service}=fixture('draft');
    expect(await service.methods(token)).toEqual({stripe:false,paypal:false});
    await expect(service.startCheckout(token,'stripe')).rejects.toBeInstanceOf(GoneException);
    expect(stripeCreate).not.toHaveBeenCalled();
  });
  it('creates a Stripe checkout from the server-owned invoice amount',async()=>{
    const {service}=fixture();
    const result=await service.startCheckout(token,'stripe');
    expect(result.provider).toBe('stripe');
    expect(stripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id:id,
        metadata:{studioInvoiceId:id,ownerUserId:'owner-A'},
        line_items:[expect.objectContaining({
          price_data:expect.objectContaining({unit_amount:25000,currency:'eur'}),
        })],
      }),expect.any(Object),
    );
  });
  it('rejects an unpaid Stripe session without changing the invoice',async()=>{
    const {service,model}=fixture();
    stripeRetrieve.mockResolvedValueOnce({
      mode:'payment',payment_status:'unpaid',status:'open',
    });
    await expect(service.verifyPayment(token,'stripe','cs_test_valid_session'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects Stripe sessions belonging to a different studio',async()=>{
    const {service,model}=fixture();
    stripeRetrieve.mockResolvedValueOnce({
      mode:'payment',payment_status:'paid',status:'complete',client_reference_id:id,
      currency:'eur',amount_total:25000,metadata:{studioInvoiceId:id,ownerUserId:'owner-B'},
    });
    await expect(service.verifyPayment(token,'stripe','cs_test_valid_session'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('atomically marks a verified Stripe invoice paid and writes one transaction',async()=>{
    const {service,model}=fixture();
    const result=await service.verifyPayment(token,'stripe','cs_test_valid_session');
    expect(result).toEqual({paid:true,alreadyPaid:false});
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(model.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id:id,userId:'owner-A',kind:'invoices',status:'sent',
    });
    expect(model.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({
      status:'paid','details.onlinePayment':expect.objectContaining({
        provider:'stripe',paymentId:'pi_test_paid',
      }),
    });
    expect(model.findOneAndUpdate.mock.calls[1][0]).toMatchObject({
      userId:'owner-A',kind:'transactions','details.onlinePaymentId':'stripe:pi_test_paid',
    });
  });
  it('creates a PayPal order using the same Store PayPal credentials',async()=>{
    const {service,model}=fixture();
    const result=await service.startCheckout(token,'paypal');
    expect(result.provider).toBe('paypal');
    expect(createPayPalOrder).toHaveBeenCalledWith(
      expect.objectContaining({clientId:'paypal-client',environment:'sandbox'}),
      expect.objectContaining({amount:250,currency:'EUR',customId:'studio:'+id}),
    );
    expect(model.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({userId:'owner-A',status:'sent'}),
      {$set:{'details.onlineCheckout.paypalOrderId':'PAYPALORDER123'}},
    );
  });
  it('verifies and captures a matching PayPal order before recording payment',async()=>{
    const {service,model}=fixture();
    const result=await service.verifyPayment(token,'paypal','PAYPALORDER123');
    expect(result.paid).toBe(true);
    expect(capturePayPalOrder).toHaveBeenCalledWith(expect.any(Object),'PAYPALORDER123');
    expect(model.findOneAndUpdate.mock.calls[0][1].$set['details.onlinePayment']).toMatchObject({
      provider:'paypal',paymentId:'CAPTURE123',
    });
  });
  it('does not capture a mismatched PayPal amount',async()=>{
    const {service}=fixture();
    (getPayPalOrder as jest.Mock).mockResolvedValueOnce({
      status:'APPROVED',purchase_units:[{custom_id:'studio:'+id,
        amount:{currency_code:'EUR',value:'99.00'}}],
    });
    await expect(service.verifyPayment(token,'paypal','PAYPALORDER123'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(capturePayPalOrder).not.toHaveBeenCalled();
  });
});
