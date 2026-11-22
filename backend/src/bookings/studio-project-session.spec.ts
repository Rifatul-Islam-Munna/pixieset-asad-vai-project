import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

const projectId='123456789012345678901234';
const contactId='223456789012345678901234';
function setup() {
  const svc:any=Object.create(BookingsService.prototype);
  const event={_id:'323456789012345678901234',kind:'booking',title:'Portrait session'};
  const studioRecordModel={
    exists:jest.fn().mockResolvedValue({_id:projectId}),
  };
  const eventModel={
    create:jest.fn().mockResolvedValue({toObject:()=>event}),
  };
  Object.assign(svc,{studioRecordModel,eventModel});
  return {svc,studioRecordModel,eventModel};
}
describe('Project-linked manual studio sessions',()=>{
  it('creates calendar events linked to the authenticated studio project and contact',async()=>{
    const {svc,studioRecordModel,eventModel}=setup();
    const result=await svc.createEvent('owner-A',{
      title:'Portrait session',kind:'booking',status:'awaiting-client',
      startAt:'2027-05-03T09:00:00.000Z',endAt:'2027-05-03T10:00:00.000Z',
      projectId,contactId,clientName:'Jane Smith',clientEmail:'jane@example.com',
    });
    expect(result.title).toBe('Portrait session');
    expect(studioRecordModel.exists).toHaveBeenCalledWith({userId:'owner-A',kind:'projects',_id:projectId});
    expect(studioRecordModel.exists).toHaveBeenCalledWith({userId:'owner-A',kind:'contacts',_id:contactId});
    expect(eventModel.create).toHaveBeenCalledWith(expect.objectContaining({
      userId:'owner-A',projectId,contactId,
      status:'awaiting-client',source:'dashboard',
    }));
  });
  it('rejects a project belonging to another studio before writing the session',async()=>{
    const {svc,studioRecordModel,eventModel}=setup();
    studioRecordModel.exists.mockResolvedValue(null);
    await expect(svc.createEvent('owner-A',{
      title:'Session',startAt:'2027-05-03T09:00:00.000Z',
      endAt:'2027-05-03T10:00:00.000Z',projectId,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(eventModel.create).not.toHaveBeenCalled();
  });
  it('rejects a contact from another owner before writing the session',async()=>{
    const {svc,studioRecordModel,eventModel}=setup();
    studioRecordModel.exists.mockImplementation((q:any)=>q.kind==='projects'?Promise.resolve({_id:projectId}):Promise.resolve(null));
    await expect(svc.createEvent('owner-A',{
      title:'Session',startAt:'2027-05-03T09:00:00.000Z',
      endAt:'2027-05-03T10:00:00.000Z',projectId,contactId,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(eventModel.create).not.toHaveBeenCalled();
  });
});
