import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudioService } from './studio.service';

const id='123456789012345678901234';
const templateId='223456789012345678901234';
const token='c'.repeat(64);
const chain=(value:any)=>({lean:jest.fn().mockResolvedValue(value)});
function fixture(){
  const model:any={
    findOne:jest.fn(),
    findOneAndUpdate:jest.fn().mockReturnValue(chain(null)),
    create:jest.fn(async(data:any)=>({toObject:()=>({_id:id,...data})})),
  };
  const service=new StudioService(model as any,{} as any,{} as any);
  return {service,model};
}
describe('Studio Manager completed-record safety',()=>{
  it.each(['paid','cancelled'])('blocks editing a %s invoice, even when only currency changes',async(status)=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({_id:id,status,kind:'invoices',userId:'studio-A',details:{lines:[]}});
    await expect(service.update('studio-A','invoices',id,{currency:'USD'})).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it.each(['completed','cancelled'])('blocks changing completed/cancelled documents: %s',async(status)=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({_id:id,status,kind:'documents',userId:'studio-A',type:'contract'});
    await expect(service.update('studio-A','documents',id,{email:'other@example.com'})).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('disallows rewriting the content of an outgoing email',async()=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({_id:id,status:'sent',kind:'messages',userId:'studio-A'});
    await expect(service.update('studio-A','messages',id,{description:'changed email'})).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('only accepts read/unread/archive changes to incoming messages',async()=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({_id:id,status:'unread',kind:'messages',userId:'studio-A'});
    await expect(service.update('studio-A','messages',id,{title:'forged'})).rejects.toBeInstanceOf(BadRequestException);
    model.findOneAndUpdate.mockReturnValue(chain({_id:id,status:'read'}));
    const result=await service.update('studio-A','messages',id,{status:'read'});
    expect(result).toMatchObject({status:'read'});
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {_id:id,userId:'studio-A',kind:'messages'},{$set:{status:'read'}},expect.any(Object));
  });
  it('never exposes a draft contract via its public link',async()=>{
    const {service,model}=fixture();
    model.findOne.mockReturnValue(chain({kind:'documents',type:'contract',status:'draft',token}));
    await expect(service.publicContract(token)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('preserves quote amount when a quote template is used',async()=>{
    const {service,model}=fixture();
    model.findOne.mockReturnValue(chain({
      _id:templateId,kind:'templates',type:'quote',status:'active',
      title:'Photo package',amount:525,currency:'USD',
      details:{content:'Scope of work'},
    }));
    const result=await service.useTemplate('studio-A',templateId,{} ) as any;
    expect(result.amount).toBe(525);
    expect(result.type).toBe('quote');
    expect(result.kind).toBe('documents');
  });
  it('updates project details without replacing existing private notes or gallery links',async()=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({
      _id:id,userId:'studio-A',kind:'projects',status:'inquiry',
      details:{bookingEventId:'123',privateNotes:[{id:'n',text:'Note'}],collectionIds:['456']},
    });
    model.findOneAndUpdate.mockReturnValue(chain({_id:id,title:'Portrait',details:{privateNotes:[{id:'n',text:'Note'}]}}));
    await service.update('studio-A','projects',id,{
      title:'Portrait',details:{location:'Studio Room A',additionalClientIds:[]},
    });
    const payload=model.findOneAndUpdate.mock.calls[0][1].$set;
    expect(payload['details.location']).toBe('Studio Room A');
    expect(payload['details.additionalClientIds']).toEqual([]);
    expect(payload).not.toHaveProperty('details');
    expect(payload).not.toHaveProperty('details.privateNotes');
  });
  it('requires using the audited project workflow for private notes',async()=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({_id:id,userId:'studio-A',kind:'projects',status:'inquiry',details:{}});
    await expect(service.update('studio-A','projects',id,{
      details:{privateNotes:[{text:'forged'}]},
    })).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each(['booked','post-production','completed','cancelled','editing'])(
    'lets an owner move the project from Inquiry to %s using the stage selector',
    async(status)=>{
      const {service,model}=fixture();
      model.findOne.mockResolvedValue({_id:id,userId:'studio-A',kind:'projects',status:'inquiry'});
      model.findOneAndUpdate.mockReturnValue(chain({_id:id,userId:'studio-A',kind:'projects',status}));
      const updated=await service.update('studio-A','projects',id,{status});
      expect(updated?.status).toBe(status);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        {_id:id,userId:'studio-A',kind:'projects'},
        {$set:{status}},expect.objectContaining({runValidators:true}),
      );
    },
  );
  it('refuses invalid stage names rather than saving unexpected content',async()=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({_id:id,userId:'studio-A',kind:'projects',status:'inquiry'});
    await expect(service.update('studio-A','projects',id,{status:'not a valid stage'}))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('lets the right-side project sheet clear an optional project date',async()=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({_id:id,userId:'studio-A',kind:'projects',status:'inquiry',date:new Date('2027-06-10')});
    model.findOneAndUpdate.mockReturnValue(chain({_id:id,date:null,status:'inquiry'}));
    const updated=await service.update('studio-A','projects',id,{date:null});
    expect(updated?.date).toBeNull();
    expect(model.findOneAndUpdate.mock.calls[0][1]).toEqual({$set:{date:null}});
  });
});
