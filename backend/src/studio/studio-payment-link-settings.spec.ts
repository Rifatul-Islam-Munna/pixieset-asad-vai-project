import {BadRequestException} from '@nestjs/common';
import {normalizePaymentLinkSettings,paymentLinkAmounts} from './studio-payment-link-settings';

const standard={
  slug:'wedding-deposit',siteSlug:'rifat39',coverImageUrl:'https://cdn.example.org/cover.jpg',
  fixedAmount:false,allowCustomAmount:false,presetAmounts:[25,50,100],
  allowTips:true,tipPresets:[5,10,20],
  confirmationMessage:'Thanks!',createProject:true,projectType:'wedding',projectStage:'booked',
  notes:'Pay to secure your date.',
};
describe('Reusable payment link security and pricing',()=>{
  it('sanitizes and preserves valid reusable link settings',()=>{
    expect(normalizePaymentLinkSettings(standard)).toMatchObject({
      slug:'wedding-deposit',siteSlug:'rifat39',presetAmounts:[25,50,100],
      allowTips:true,createProject:true,projectStage:'booked',
    });
  });
  it('allows a selected preset plus optional tip',()=>{
    expect(paymentLinkAmounts(normalizePaymentLinkSettings(standard),0,50,10))
      .toEqual({amount:50,tip:10,total:60});
  });
  it('allows a decimal price and tip without floating point false positives',()=>{
    expect(paymentLinkAmounts(normalizePaymentLinkSettings({
      ...standard,allowCustomAmount:true,
    }),0,0.29,0.15)).toEqual({amount:0.29,tip:0.15,total:0.44});
  });
  it('rejects an amount outside the presets when custom amount is off',()=>{
    expect(()=>paymentLinkAmounts(normalizePaymentLinkSettings(standard),0,5,0))
      .toThrow(BadRequestException);
  });
  it('ignores client edits to a fixed-price link',()=>{
    const config=normalizePaymentLinkSettings({...standard,fixedAmount:true});
    expect(()=>paymentLinkAmounts(config,100,50,0)).toThrow(BadRequestException);
    expect(paymentLinkAmounts(config,100,100,0)).toEqual({amount:100,tip:0,total:100});
  });
  it('rejects a tip when tips are disabled',()=>{
    expect(()=>paymentLinkAmounts(normalizePaymentLinkSettings({...standard,allowTips:false}),0,50,10))
      .toThrow(BadRequestException);
  });
  it.each([
    {'slug':'javascript:alert(1)'},{siteSlug:'bad.site'}, {coverImageUrl:'javascript:alert(1)'},
    {presetAmounts:[-5]},{presetAmounts:[25,25]},
    {tipPresets:[100001]},{projectStage:'<script>'},
  ])('rejects malicious or invalid settings %#',override=>{
    expect(()=>normalizePaymentLinkSettings({...standard,...override})).toThrow(BadRequestException);
  });
  it('requires custom amount or presets for variable-price links',()=>{
    expect(()=>normalizePaymentLinkSettings({...standard,presetAmounts:[],allowCustomAmount:false}))
      .toThrow(BadRequestException);
  });
});
