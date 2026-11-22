export type QuoteItemType="standard"|"selection"|"optional";
export type QuoteOption={id:string;name:string;description:string;quantity:number;unitPrice:number};
export type QuoteItem={id:string;type:QuoteItemType;title:string;description:string;
  quantity:number;unitPrice:number;options:QuoteOption[]};
export type QuoteSelections=Record<string,string|string[]>;
export type QuoteTotals={subtotal:number;discount:number;tax:number;total:number;
  lines:Array<{name:string;description:string;quantity:number;unitPrice:number}>};
const round=(value:number)=>Math.round(value*100)/100;
export const newQuoteId=()=>Math.random().toString(36).slice(2,12);
export function createQuoteItem(type:QuoteItemType):QuoteItem{
  return {
    id:newQuoteId(),type,
    title:type==="standard"?"":type==="selection"?"Packages":"Optional services",
    description:"",quantity:1,unitPrice:0,
    options:type==="standard"?[]:[{id:newQuoteId(),name:"",description:"",quantity:1,unitPrice:0}],
  };
}
export function quoteTotals(
  items:QuoteItem[],choices:QuoteSelections,discountPercent:number,taxPercent:number,minimum=false,
):QuoteTotals {
  const lines:QuoteTotals["lines"]=[];
  for(const item of items){
    if(item.type==="standard"){
      lines.push({name:item.title,description:item.description,quantity:item.quantity,unitPrice:item.unitPrice});
      continue;
    }
    let selected:string[]=[];
    if(minimum){
      if(item.type==="selection"&&item.options.length){
        selected=[item.options.reduce((a,b)=>a.quantity*a.unitPrice<b.quantity*b.unitPrice?a:b).id];
      }
    }else{
      const chosen=choices[item.id];
      if(typeof chosen==="string")selected=[chosen];
      if(Array.isArray(chosen))selected=chosen;
    }
    for(const id of selected){
      const option=item.options.find(x=>x.id===id);
      if(option)lines.push({name:option.name,description:option.description,
        quantity:option.quantity,unitPrice:option.unitPrice});
    }
  }
  const subtotal=round(lines.reduce((sum,x)=>sum+Math.max(0,Number(x.quantity)||0)*Math.max(0,Number(x.unitPrice)||0),0));
  const discount=round(subtotal*Math.max(0,Math.min(100,discountPercent||0))/100);
  const tax=round((subtotal-discount)*Math.max(0,Math.min(100,taxPercent||0))/100);
  return {lines,subtotal,discount,tax,total:round(subtotal-discount+tax)};
}
export function displayQuoteMoney(value:number,currency:string){
  return currency+" "+Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}
