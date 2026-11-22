import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { StudioService } from './studio.service';

const id='123456789012345678901234';
const templateId='223456789012345678901234';
function query(value:unknown) {
  const q:any={lean:jest.fn().mockResolvedValue(value),select:jest.fn()};
  q.select.mockReturnValue(q);
  return q;
}
function fixture(){
  const model={
    aggregate:jest.fn(),
    find:jest.fn().mockReturnValue({sort:jest.fn().mockReturnValue({limit:jest.fn().mockReturnValue(query([]))})}),
    findOne:jest.fn(),
    exists:jest.fn().mockResolvedValue({_id:id}),
    create:jest.fn(async(data:any)=>({toObject:()=>({_id:id,...data})})),
  };
  const mail={send:jest.fn().mockResolvedValue({sent:true})};
  const config={get:jest.fn()};
  return {service:new StudioService(model as any,mail as any,config as any),model,mail};
}

describe('Studio finance and linked workflows',()=>{
  it('separates paid invoice totals by currency',async()=>{
    const {service,model}=fixture();
    model.aggregate.mockResolvedValueOnce([
      {_id:{currency:'BDT',status:'paid'},amount:10000,count:2,overdue:0},
      {_id:{currency:'USD',status:'paid'},amount:90,count:1,overdue:0},
      {_id:{currency:'BDT',status:'sent'},amount:4000,count:1,overdue:4000},
    ]).mockResolvedValueOnce([
      {_id:{currency:'BDT',month:'2026-11'},amount:10000},
      {_id:{currency:'USD',month:'2026-11'},amount:90},
    ]);
    const report=await service.financialReport('studio-A');
    expect(report.currencies).toHaveLength(2);
    expect(report.currencies.find(x=>x.currency==='BDT')).toMatchObject({
      currency:'BDT',paid:10000,unpaid:4000,overdue:4000,paidCount:2,invoiceCount:3,
    });
    expect(report.currencies.find(x=>x.currency==='USD')).toMatchObject({paid:90,unpaid:0,paidCount:1});
    expect(report.currencies.find(x=>x.currency==='BDT')?.monthly[0]).toEqual({month:'2026-11',amount:10000});
    expect(model.aggregate.mock.calls[0][0][0]).toEqual({$match:{userId:'studio-A',kind:'invoices'}});
  });
  it('groups paid invoices and verified payment-link receipts without double-counting invoice transactions',async()=>{
    const {service,model}=fixture();
    model.aggregate.mockResolvedValueOnce([{_id:{projectId:id,currency:'BDT'},amount:5000}]);
    const rows=await service.projectPayments('studio-A');
    expect(rows).toEqual([{projectId:id,currency:'BDT',amount:5000}]);
    expect(model.aggregate.mock.calls[0][0][0]).toEqual({$match:{
      userId:'studio-A',projectId:{$nin:['',null]},$or:[
        {kind:'invoices',status:'paid'},
        {kind:'transactions',status:'paid','details.paymentLinkId':{$exists:true}},
      ],
    }});
  });
  it('uses saved invoice template items to create a draft invoice for a client',async()=>{
    const {service,model}=fixture();
    model.findOne.mockReturnValue(query({
      _id:templateId,kind:'templates',userId:'studio-A',type:'invoice',
      title:'Wedding package',description:'Photography',
      details:{lines:[{name:'Session',quantity:2,unitPrice:100}],taxPercent:10,discountPercent:0},
    }));
    const result=await service.useTemplate('studio-A',templateId,{contactId:id,currency:'BDT'}) as any;
    expect(result.kind).toBe('invoices');
    expect(result.userId).toBe('studio-A');
    expect(result.status).toBe('draft');
    expect(result.amount).toBe(220);
    expect(result.details.lines[0].name).toBe('Session');
    expect(model.exists).toHaveBeenCalledWith({userId:'studio-A',kind:'contacts',_id:id});
  });
  it('requires an invoice client when using invoice templates',async()=>{
    const {service,model}=fixture();
    model.findOne.mockReturnValue(query({_id:templateId,type:'invoice',title:'Invoice',details:{}}));
    await expect(service.useTemplate('studio-A',templateId,{})).rejects.toBeInstanceOf(BadRequestException);
  });
  it('sends an email and logs it under the authenticated studio',async()=>{
    const {service,model,mail}=fixture();
    model.findOne.mockReturnValue(query({title:'Jane',email:'jane@example.com'}));
    const result=await service.sendEmail('studio-A',{
      contactId:id,subject:'Your photos',content:'We have uploaded your images.',
    }) as any;
    expect(result.kind).toBe('messages');
    expect(result.userId).toBe('studio-A');
    expect(result.status).toBe('sent');
    expect(mail.send).toHaveBeenCalledWith({
      to:'jane@example.com',subject:'Your photos',text:'We have uploaded your images.',
    });
  });
  it('does not log unsuccessful SMTP delivery as sent',async()=>{
    const {service,model,mail}=fixture();
    mail.send.mockResolvedValue({sent:false});
    await expect(service.sendEmail('studio-A',{
      email:'jane@example.com',subject:'Test',content:'Message',
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(model.create).not.toHaveBeenCalled();
  });
  it('rejects missing email when creating contacts',async()=>{
    const {service,model}=fixture();
    await expect(service.create('studio-A','contacts',{title:'No email'})).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });
});
