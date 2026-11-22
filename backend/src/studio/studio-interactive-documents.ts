import {BadRequestException} from '@nestjs/common';

type Source=Record<string,unknown>;
export type QuestionnaireField={
  name:string;label:string;type:'text'|'textarea'|'date'|'select'|'radio'|'checkbox';
  required:boolean;options:string;allowOther:boolean;
};
export type QuoteOption={id:string;name:string;description:string;quantity:number;unitPrice:number};
export type QuoteItem={id:string;type:'standard'|'selection'|'optional';title:string;
  description:string;quantity:number;unitPrice:number;options:QuoteOption[]};
export type QuotePricing={subtotal:number;discount:number;tax:number;total:number;
  lines:Array<{name:string;description:string;quantity:number;unitPrice:number}>};
const safe=(value:unknown,max=160)=>String(value??'').trim().slice(0,max);
const key=(value:unknown)=>/^[a-zA-Z0-9_-]{1,70}$/.test(String(value??''))?String(value):'';
const money=(value:unknown,max=100000000)=>{
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>max||Math.abs(Math.round(n*100)-n*100)>0.000001)
    throw new BadRequestException('Enter a valid non-negative price with at most two decimals');
  return Math.round(n*100)/100;
};
const quantity=(value:unknown)=>{
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0||n>10000||Math.abs(Math.round(n*100)-n*100)>0.000001)
    throw new BadRequestException('Item quantities must be greater than zero and have at most two decimals');
  return n;
};
export function validateQuestionnaireFields(raw:unknown):QuestionnaireField[]{
  if(!Array.isArray(raw)||raw.length>30)throw new BadRequestException('A questionnaire supports up to 30 questions');
  const names=new Set<string>();
  return raw.map((item)=>{
    const value=(item&&typeof item==='object'&&!Array.isArray(item))?item as Source:{};
    const name=key(value.name);
    const label=safe(value.label,180);
    const type=value.type;
    if(!name||!label||names.has(name)||!['text','textarea','date','select','radio','checkbox'].includes(String(type)))
      throw new BadRequestException('Each question needs a unique key, label and supported answer type');
    names.add(name);
    const options=Array.isArray(value.options)?
      value.options.map((v:unknown)=>safe(v,140)).filter(Boolean):
      String(value.options??'').split(',').map(v=>safe(v,140)).filter(Boolean);
    if(options.length>25||new Set(options).size!==options.length)
      throw new BadRequestException('Question options must be unique (maximum 25)');
    if(['select','radio','checkbox'].includes(String(type))&&!options.length)
      throw new BadRequestException('Choice questions must have at least one option');
    return {name,label,type:type as QuestionnaireField['type'],required:value.required===true,
      options:options.join(','),allowOther:value.allowOther===true&&['radio','checkbox'].includes(String(type))};
  });
}
export function validateQuestionnaireAnswers(fields:QuestionnaireField[],answers:Source){
  const allowed=new Set(fields.map(field=>field.name));
  if(Object.keys(answers).some(k=>!allowed.has(k)))
    throw new BadRequestException('Unknown questionnaire field');
  const responses:Record<string,string>={};
  for(const field of fields){
    const raw=answers[field.name];
    if(raw!==undefined&&typeof raw!=='string')
      throw new BadRequestException('Invalid answer for '+field.label);
    const value=safe(raw,3000);
    if(field.required&&!value)throw new BadRequestException('Answer required: '+field.label);
    if(['select','radio','checkbox'].includes(field.type)&&value){
      const options=field.options.split(',').filter(Boolean);
      const values=field.type==='checkbox'?value.split(' | ').map(v=>v.trim()):[value];
      if(values.length>25||new Set(values).size!==values.length||
        values.some(v=>!options.includes(v)&&!(field.allowOther&&/^Other: .{1,130}$/.test(v))))
        throw new BadRequestException('Invalid answer choice: '+field.label);
    }
    if(field.type==='date'&&value){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new BadRequestException('Invalid date answer: '+field.label);
      const parsed=new Date(value+'T00:00:00Z');
      if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)
        throw new BadRequestException('Invalid date answer: '+field.label);
    }
    responses[field.name]=value;
  }
  return responses;
}
export function validateQuoteItems(raw:unknown):QuoteItem[]{
  if(!Array.isArray(raw)||raw.length>25)
    throw new BadRequestException('Quotes support up to 25 item groups');
  const seen=new Set<string>();
  return raw.map((item)=>{
    const row=item&&typeof item==='object'&&!Array.isArray(item)?item as Source:{};
    const id=key(row.id),type=row.type;
    if(!id||seen.has(id)||!['standard','selection','optional'].includes(String(type)))
      throw new BadRequestException('Quote items require unique IDs and a supported type');
    seen.add(id);
    const optionsRaw=type==='standard'?[]:row.options;
    if(!Array.isArray(optionsRaw)||optionsRaw.length>25)
      throw new BadRequestException('A quote group supports up to 25 options');
    const optionIds=new Set<string>();
    const options=optionsRaw.map((option)=>{
      const v=option&&typeof option==='object'&&!Array.isArray(option)?option as Source:{};
      const keyId=key(v.id),name=safe(v.name,180);
      if(!keyId||optionIds.has(keyId)||!name)
        throw new BadRequestException('Quote options require unique IDs and names');
      optionIds.add(keyId);
      return {id:keyId,name,description:safe(v.description,600),quantity:quantity(v.quantity??1),
        unitPrice:money(v.unitPrice??0)};
    });
    if(type!=='standard'&&!options.length)
      throw new BadRequestException('Choose at least one option for each quote selection group');
    const title=safe(row.title,180);
    if(type==='standard'&&!title)throw new BadRequestException('Standard quote items require names');
    return {id,type:type as QuoteItem['type'],title,description:safe(row.description,600),
      quantity:type==='standard'?quantity(row.quantity??1):1,
      unitPrice:type==='standard'?money(row.unitPrice??0):0,options};
  });
}
export function quotePrice(items:QuoteItem[],selections:Source,discountPercent=0,taxPercent=0,
  minimum=false):QuotePricing {
  if(!Number.isFinite(discountPercent)||discountPercent<0||discountPercent>100||
    !Number.isFinite(taxPercent)||taxPercent<0||taxPercent>100)
    throw new BadRequestException('Discount and tax must be between 0 and 100');
  const allowed=new Set(items.map(item=>item.id));
  if(Object.keys(selections).some(id=>!allowed.has(id)))
    throw new BadRequestException('Unknown quote item selection');
  const lines:QuotePricing['lines']=[];
  for(const item of items){
    if(item.type==='standard'){
      lines.push({name:item.title,description:item.description,quantity:item.quantity,unitPrice:item.unitPrice});
      continue;
    }
    let selected:string[]=[];
    if(minimum){
      if(item.type==='selection'&&item.options.length){
        selected=[item.options.reduce((a,b)=>a.quantity*a.unitPrice<b.quantity*b.unitPrice?a:b).id];
      }
    }else{
      const response=selections[item.id];
      if(response!==undefined&&typeof response!=='string'&&!Array.isArray(response))
        throw new BadRequestException('Invalid quote selections');
      if(item.type==='selection'){
        if(typeof response!=='string'||!response)
          throw new BadRequestException('Choose an option for '+(item.title||'this group'));
        selected=[response];
      }else{
        if(response===undefined)selected=[];
        else if(Array.isArray(response)&&response.every(v=>typeof v==='string'))selected=response as string[];
        else throw new BadRequestException('Invalid optional quote choices');
      }
    }
    if(new Set(selected).size!==selected.length||selected.some(id=>!item.options.some(o=>o.id===id)))
      throw new BadRequestException('Invalid quote option for '+item.title);
    for(const id of selected){
      const option=item.options.find(o=>o.id===id)!;
      lines.push({name:option.name,description:option.description,quantity:option.quantity,unitPrice:option.unitPrice});
    }
  }
  const subtotal=money(lines.reduce((sum,row)=>sum+row.quantity*row.unitPrice,0));
  const discount=money(Math.round(subtotal*discountPercent)/100);
  const tax=money(Math.round((subtotal-discount)*taxPercent)/100);
  return {lines,subtotal,discount,tax,total:money(subtotal-discount+tax)};
}
