import { NotFoundException } from '@nestjs/common';
import { StudioCalendarService } from './studio-calendar.service';

const token='a'.repeat(64);
function q(value:unknown) { return { lean: jest.fn().mockResolvedValue(value) }; }
function fixture() {
  const feeds={
    findOne: jest.fn().mockReturnValue(q(null)),
    create: jest.fn().mockResolvedValue({ userId:'studio-A', token }),
    findOneAndUpdate: jest.fn().mockResolvedValue({ token }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount:1 }),
  };
  const eventItems=[{
    _id:'123456789012345678901234',
    startAt:new Date('2027-01-15T09:00:00.000Z'),
    endAt:new Date('2027-01-15T10:00:00.000Z'),
    status:'confirmed',
    title:'Wedding, Portrait Session',
    notes:'Do not bring\nthe red backdrop',
    location:'Studio; Main Hall',
  }];
  const events={
    find:jest.fn().mockReturnValue({
      sort:jest.fn().mockReturnValue({
        limit:jest.fn().mockReturnValue(q(eventItems)),
      }),
    }),
  };
  const config={ get:jest.fn((key:string)=>key==='FRONTEND_URL'?'https://gallerista.app':undefined) };
  const service=new StudioCalendarService(feeds as any,events as any,config as any);
  return {service,feeds,events,eventItems};
}

describe('Studio calendar subscriptions',()=>{
  it('uses one private token per studio to issue a subscription URL',async()=>{
    const {service,feeds}=fixture();
    const result=await service.getOrCreate('studio-A');
    expect(result.url).toBe('https://gallerista.app/api/studio/calendar/'+token+'.ics');
    expect(result.kind).toBe('read-only-subscription');
    expect(feeds.findOne).toHaveBeenCalledWith({userId:'studio-A'});
  });
  it('reuses an existing calendar subscription',async()=>{
    const {service,feeds}=fixture();
    feeds.findOne.mockReturnValue(q({token,userId:'studio-A'}));
    const result=await service.getOrCreate('studio-A');
    expect(result.url).toContain(token);
    expect(feeds.create).not.toHaveBeenCalled();
  });
  it('does not silently reactivate a disabled calendar subscription',async()=>{
    const {service,feeds}=fixture();
    feeds.findOne.mockReturnValue(q({token,userId:'studio-A',disabled:true}));
    const result=await service.getOrCreate('studio-A');
    expect(result).toMatchObject({enabled:false,url:''});
    expect(feeds.create).not.toHaveBeenCalled();
  });
  it('only returns bookings for the owner and does not disclose client emails',async()=>{
    const {service,feeds,events}=fixture();
    feeds.findOne.mockReturnValue(q({userId:'studio-A',token}));
    const result=await service.render(token);
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('BEGIN:VEVENT');
    expect(result).toContain('SUMMARY:Wedding\\, Portrait Session');
    expect(result).toContain('DESCRIPTION:Do not bring\\nthe red backdrop');
    expect(result).toContain('LOCATION:Studio\\; Main Hall');
    expect(result).not.toContain('clientEmail');
    expect(feeds.findOne).toHaveBeenCalledWith({token,disabled:{$ne:true}});
    expect(events.find).toHaveBeenCalledWith(expect.objectContaining({userId:'studio-A',status:{$ne:'cancelled'}}));
  });
  it('never returns a feed for an invalid token',async()=>{
    const {service,events}=fixture();
    await expect(service.render('bad-token')).rejects.toBeInstanceOf(NotFoundException);
    expect(events.find).not.toHaveBeenCalled();
  });
  it('revokes an existing token and permits replacement',async()=>{
    const {service,feeds}=fixture();
    const rotated=await service.rotate('studio-A');
    expect(rotated.url).toContain('/studio/calendar/');
    expect(rotated.url).not.toContain(token+'.ics');
    expect(feeds.findOneAndUpdate).toHaveBeenCalledWith({userId:'studio-A'},expect.any(Object),expect.any(Object));
    expect((await service.revoke('studio-A')).enabled).toBe(false);
    expect(feeds.updateOne).toHaveBeenCalledWith({userId:'studio-A'},
      {$set:{disabled:true,token:expect.stringMatching(/^[a-f0-9]{64}$/)}});
    const enabled=await service.enable('studio-A');
    expect(enabled.enabled).toBe(true);
    expect(enabled.url).not.toContain(token+'.ics');
  });
});
