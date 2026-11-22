import {BadRequestException} from '@nestjs/common';
import {
  quotePrice,validateQuoteItems,validateQuestionnaireFields,validateQuestionnaireAnswers,
} from './studio-interactive-documents';

const quote=[
  {id:'base',type:'standard',title:'Portrait consultation',description:'One hour',
    quantity:1,unitPrice:40,options:[]},
  {id:'package',type:'selection',title:'Choose a package',description:'',
    options:[
      {id:'silver',name:'Silver package',description:'Basic session',quantity:1,unitPrice:100},
      {id:'gold',name:'Gold package',description:'Extended session',quantity:1,unitPrice:200},
    ]},
  {id:'extras',type:'optional',title:'Optional services',options:[
    {id:'prints',name:'Prints',quantity:2,unitPrice:15},
    {id:'retouch',name:'Retouching',quantity:1,unitPrice:25},
  ]},
];
describe('Studio questionnaire multiple-choice fields',()=>{
  const fields=validateQuestionnaireFields([
    {name:'occasion',label:'Type of event',type:'radio',required:true,options:'Wedding,Portrait',allowOther:true},
    {name:'services',label:'Additional services',type:'checkbox',required:true,options:'Prints,Video'},
    {name:'notes',label:'More details',type:'textarea',required:false},
  ]);
  it('preserves multiple-choice and checkbox settings for the public form',()=>{
    expect(fields[0]).toMatchObject({type:'radio',options:'Wedding,Portrait',allowOther:true});
    expect(fields[1]).toMatchObject({type:'checkbox',required:true});
  });
  it('records valid single and multiple selections',()=>{
    expect(validateQuestionnaireAnswers(fields,{
      occasion:'Other: Corporate event',services:'Prints | Video',notes:'See you',
    })).toMatchObject({occasion:'Other: Corporate event',services:'Prints | Video'});
  });
  it('rejects values not present in the configured options',()=>{
    expect(()=>validateQuestionnaireAnswers(fields,{
      occasion:'Private password',services:'Prints',
    })).toThrow(BadRequestException);
  });
  it('rejects missing required answers and unknown question keys',()=>{
    expect(()=>validateQuestionnaireAnswers(fields,{occasion:'Wedding'})).toThrow(BadRequestException);
    expect(()=>validateQuestionnaireAnswers(fields,{
      occasion:'Wedding',services:'Prints',unknown:'Admin',
    })).toThrow(BadRequestException);
  });
  it('rejects impossible calendar dates rather than accepting a formatted typo',()=>{
    const dateFields=validateQuestionnaireFields([
      {name:'event_date',label:'Event date',type:'date',required:true},
    ]);
    expect(()=>validateQuestionnaireAnswers(dateFields,{event_date:'2026-02-30'}))
      .toThrow(BadRequestException);
    expect(validateQuestionnaireAnswers(dateFields,{event_date:'2028-02-29'}))
      .toMatchObject({event_date:'2028-02-29'});
  });
  it('rejects invalid/duplicate questions, blank options and unsupported types',()=>{
    expect(()=>validateQuestionnaireFields([
      {name:'same',label:'First',type:'radio',options:'Yes,No'},
      {name:'same',label:'Second',type:'text'},
    ])).toThrow(BadRequestException);
    expect(()=>validateQuestionnaireFields([
      {name:'choice',label:'Choose',type:'radio',options:''},
    ])).toThrow(BadRequestException);
    expect(()=>validateQuestionnaireFields([
      {name:'unknown',label:'Choose',type:'script',options:'a'},
    ])).toThrow(BadRequestException);
  });
});
describe('Studio quote standard, client selection and optional items',()=>{
  const items=validateQuoteItems(quote);
  it('uses the cheapest mandatory option as the initial quote minimum',()=>{
    const result=quotePrice(items,{},10,5,true);
    expect(result).toMatchObject({subtotal:140,discount:14,tax:6.3,total:132.3});
  });
  it('calculates the actual client-chosen price from saved item prices',()=>{
    const result=quotePrice(items,{package:'gold',extras:['prints','retouch']},10,5);
    expect(result).toMatchObject({subtotal:295,discount:29.5,tax:13.28,total:278.78});
    expect(result.lines.map(x=>x.name)).toEqual([
      'Portrait consultation','Gold package','Prints','Retouching',
    ]);
  });
  it('requires exactly one option from each selection group',()=>{
    expect(()=>quotePrice(items,{},0,0)).toThrow(BadRequestException);
    expect(()=>quotePrice(items,{package:['silver','gold']},0,0)).toThrow(BadRequestException);
  });
  it('rejects forged item IDs, duplicate choices or unknown groups',()=>{
    expect(()=>quotePrice(items,{package:'discounted-free-item'},0,0))
      .toThrow(BadRequestException);
    expect(()=>quotePrice(items,{package:'silver',extras:['prints','prints']},0,0))
      .toThrow(BadRequestException);
    expect(()=>quotePrice(items,{package:'silver',forged:'gold'},0,0))
      .toThrow(BadRequestException);
  });
  it('rejects item prices that cannot be safely charged',()=>{
    expect(()=>validateQuoteItems([{
      id:'bad',type:'standard',title:'Unpaid work',unitPrice:-10,quantity:1,
    }])).toThrow(BadRequestException);
    expect(()=>validateQuoteItems([{
      id:'bad',type:'standard',title:'Unpaid work',unitPrice:99.999,quantity:1,
    }])).toThrow(BadRequestException);
  });
});
