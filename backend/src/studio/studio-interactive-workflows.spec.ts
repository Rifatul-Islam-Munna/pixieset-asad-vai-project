import {BadRequestException,GoneException} from '@nestjs/common';
import {StudioService} from './studio.service';

const quoteId='123456789012345678901234';
const contactId='223456789012345678901234';
const projectId='323456789012345678901234';
const token='c'.repeat(64);
const quoteItems=[
  {id:'base',type:'standard',title:'Studio session',description:'',quantity:1,unitPrice:100,options:[]},
  {id:'package',type:'selection',title:'Choose a package',description:'',options:[
    {id:'basic',name:'Basic',description:'',quantity:1,unitPrice:50},
    {id:'premium',name:'Premium',description:'',quantity:1,unitPrice:150},
  ]},
  {id:'extras',type:'optional',title:'Add-on services',description:'',options:[
    {id:'prints',name:'Printed album',description:'',quantity:2,unitPrice:20},
  ]},
];
const quote={
  _id:quoteId,userId:'owner-A',kind:'documents',type:'quote',
  status:'in-progress',title:'Portrait quote',description:'Portrait session',
  token,contactId,projectId,email:'jane@example.com',amount:150,currency:'BDT',
  details:{quoteItems,discountPercent:10,taxPercent:5,autoCreateInvoice:true,notes:'Thank you'},
};
const query=(value:unknown)=>({lean:jest.fn().mockResolvedValue(value)});
function fixture(document:any=quote){
  const created:any[]=[];
  const model:any={
    findOne:jest.fn((filter:any)=>{
      if(filter.kind==='documents')return Promise.resolve(document);
      if(filter.kind==='invoices')return query(null);
      return Promise.resolve(null);
    }),
    findOneAndUpdate:jest.fn((_filter:any,updates:any)=>
      query({...document,...updates.$set})),
    create:jest.fn(async (values:any)=>{
      const value={_id:'423456789012345678901234',...values,
        toObject:()=>({...values,_id:'423456789012345678901234'})};
      created.push(value);return value;
    }),
    exists:jest.fn().mockResolvedValue({_id:projectId}),
  };
  const service=new StudioService(model,{send:jest.fn()} as any,{get:jest.fn()} as any);
  return {service,model,created};
}
describe('Interactive quote submission and invoice creation',()=>{
  it('uses the actual selected quote prices and creates exactly one linked draft invoice',async()=>{
    const {service,model,created}=fixture();
    const result=await service.acceptQuote(token,{
      signerName:'Jane Doe',accept:true,
      selections:{package:'premium',extras:['prints']},
    });
    expect(result).toMatchObject({accepted:true,amount:274.05,
      invoiceId:'423456789012345678901234'});
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({_id:quoteId,status:'in-progress'}),
      {$set:expect.objectContaining({status:'completed',amount:274.05})},
      {returnDocument:'after'},
    );
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      kind:'invoices',status:'draft',contactId,projectId,currency:'BDT',amount:274.05,
      details:expect.objectContaining({sourceQuoteId:quoteId}),
    });
    expect(created[0].details.lines.map((v:any)=>v.name)).toEqual([
      'Studio session','Premium','Printed album',
    ]);
  });
  it('rejects a quote when mandatory choices were not submitted',async()=>{
    const {service,model,created}=fixture();
    await expect(service.acceptQuote(token,{
      signerName:'Jane Doe',accept:true,selections:{extras:['prints']},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });
  it('rejects attempts to inject a fake cheap quote option',async()=>{
    const {service,model}=fixture();
    await expect(service.acceptQuote(token,{
      signerName:'Jane Doe',accept:true,selections:{package:'free-plan'},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('does not create an invoice when the owner disabled auto invoice',async()=>{
    const {service,created}=fixture({...quote,details:{...quote.details,autoCreateInvoice:false}});
    const result=await service.acceptQuote(token,{
      signerName:'Jane Doe',accept:true,selections:{package:'basic'},
    });
    expect(result.accepted).toBe(true);
    expect(result.invoiceId).toBe('');
    expect(created).toHaveLength(0);
  });
  it('rejects expired quotes before acceptance',async()=>{
    const {service,model}=fixture({...quote,dueDate:new Date('2024-01-01T00:00:00Z')});
    await expect(service.acceptQuote(token,{
      signerName:'Jane Doe',accept:true,selections:{package:'basic'},
    })).rejects.toBeInstanceOf(GoneException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('only accepts each quote once through an atomic document transition',async()=>{
    const {service,model}=fixture();
    model.findOneAndUpdate.mockReturnValueOnce(query(null));
    await expect(service.acceptQuote(token,{
      signerName:'Jane Doe',accept:true,selections:{package:'basic'},
    })).rejects.toBeInstanceOf(GoneException);
    expect(model.create).not.toHaveBeenCalled();
  });
});
describe('Sent document immutability',()=>{
  it('does not allow sent quotes to be reopened, rewritten or deleted',async()=>{
    const {service,model}=fixture();
    await expect(service.update('owner-A','documents',quoteId,{status:'draft'}))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('owner-A','documents',quoteId,{description:'Changed after sending'}))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove('owner-A','documents',quoteId))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
describe('Interactive questionnaire responses',()=>{
  const questionnaire={
    ...quote,type:'questionnaire',details:{fields:[
      {name:'kind',label:'What is your event?',type:'radio',required:true,options:'Wedding,Portrait',allowOther:true},
      {name:'extras',label:'Extras',type:'checkbox',required:false,options:'Album,Video'},
    ]},
  };
  it('records only configured choices and notifies the studio inbox',async()=>{
    const {service,model,created}=fixture(questionnaire);
    const result=await service.submitQuestionnaire(token,{
      responses:{kind:'Portrait',extras:'Album | Video'},
    });
    expect(result.submitted).toBe(true);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({_id:quoteId,status:'in-progress'}),
      {$set:expect.objectContaining({status:'completed',details:expect.objectContaining({
        responses:{kind:'Portrait',extras:'Album | Video'},
      })})},
      {returnDocument:'after'},
    );
    expect(created).toHaveLength(1);
    expect(created[0].kind).toBe('messages');
  });
  it('rejects unknown questionnaire options',async()=>{
    const {service,model}=fixture(questionnaire);
    await expect(service.submitQuestionnaire(token,{
      responses:{kind:'Anything',extras:'Album'},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
