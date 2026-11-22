import { BookingsService } from './bookings.service';

const eventId='123456789012345678901234';
const contactId='223456789012345678901234';
const projectId='323456789012345678901234';
const ownerId='423456789012345678901234';
const serviceId='523456789012345678901234';
const event={
  _id:eventId,userId:ownerId,clientName:'Jane Smith',clientEmail:'jane@example.com',
  clientPhone:'12345',startAt:new Date('2027-01-15T09:00:00.000Z'),endAt:new Date('2027-01-15T10:00:00.000Z'),
  serviceId,kind:'booking',projectId,contactId,source:'public',
};
function query(value:any){return {lean:jest.fn().mockResolvedValue(value)};}
function fixture(status='lead'){
  const crm={
    findOneAndUpdate:jest.fn().mockReturnValue(query({_id:contactId,status})),
    create:jest.fn().mockResolvedValue({_id:projectId,kind:'projects'}),
    updateOne:jest.fn().mockResolvedValue({modifiedCount:1}),
  };
  const booking={
    updateOne:jest.fn().mockResolvedValue({modifiedCount:1}),
    findOne:jest.fn().mockReturnValue(query(event)),
    findOneAndUpdate:jest.fn().mockReturnValue(query({...event,status:'confirmed'})),
    findOneAndDelete:jest.fn().mockReturnValue(query(event)),
  };
  const svc:any=Object.create(BookingsService.prototype);
  Object.assign(svc,{studioRecordModel:crm,eventModel:booking,logger:{warn:jest.fn()}});
  return {svc,crm,booking};
}
describe('Public bookings sync with Studio Manager CRM',()=>{
  it('creates a lead, inquiry project and links the booking event',async()=>{
    const {svc,crm,booking}=fixture();
    await svc.linkPublicBookingToStudio(ownerId,event,{_id:serviceId,name:'Family portrait'},'Jane Smith','jane@example.com','pending');
    expect(crm.findOneAndUpdate).toHaveBeenCalledWith(
      {userId:ownerId,kind:'contacts',email:'jane@example.com'},
      expect.objectContaining({$setOnInsert:expect.objectContaining({status:'lead'})}),
      expect.objectContaining({upsert:true}),
    );
    expect(crm.create).toHaveBeenCalledWith(expect.objectContaining({
      userId:ownerId,kind:'projects',status:'inquiry',contactId,
      details:expect.objectContaining({bookingEventId:eventId}),
    }));
    expect(booking.updateOne).toHaveBeenCalledWith({_id:eventId,userId:ownerId},
      {$set:{contactId,projectId}});
  });
  it('converts a confirmed public booking into a booked project and client',async()=>{
    const {svc,crm}=fixture();
    await svc.linkPublicBookingToStudio(ownerId,event,{_id:serviceId,name:'Wedding'},'Jane Smith','jane@example.com','confirmed');
    expect(crm.updateOne).toHaveBeenCalledWith(
      {_id:contactId,userId:ownerId,kind:'contacts',status:'lead'},{$set:{status:'client'}},
    );
    expect(crm.create).toHaveBeenCalledWith(expect.objectContaining({status:'booked'}));
  });
  it('moves a linked project when a session is confirmed',async()=>{
    const {svc,crm}=fixture();
    await svc.updateEvent(ownerId,eventId,{status:'confirmed'});
    expect(crm.updateOne).toHaveBeenCalledWith(
      {_id:projectId,userId:ownerId,kind:'projects','details.bookingEventId':eventId},
      {$set:{status:'booked'}},
    );
    expect(crm.updateOne).toHaveBeenCalledWith(
      {_id:contactId,userId:ownerId,kind:'contacts',status:'lead'},{$set:{status:'client'}},
    );
  });
  it('moves a linked project to cancelled when the session is deleted',async()=>{
    const {svc,crm}=fixture();
    const result=await svc.deleteEvent(ownerId,eventId);
    expect(result.deleted).toBe(true);
    expect(crm.updateOne).toHaveBeenCalledWith(
      {_id:projectId,userId:ownerId,kind:'projects','details.bookingEventId':eventId},
      {$set:{status:'cancelled'}},
    );
  });
});
