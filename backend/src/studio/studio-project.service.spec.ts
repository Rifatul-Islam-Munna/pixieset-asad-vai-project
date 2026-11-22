import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudioProjectService } from './studio-project.service';

const p='123456789012345678901234';
const c='223456789012345678901234';
const g='323456789012345678901234';
const noteId='123e4567-e89b-12d3-a456-426614174000';
function chain(value:any){
  const x:any={lean:jest.fn().mockResolvedValue(value),sort:jest.fn(),limit:jest.fn(),select:jest.fn()};
  x.sort.mockReturnValue(x);x.limit.mockReturnValue(x);x.select.mockReturnValue(x);
  return x;
}
function fixture(){
  const project:any={_id:p,userId:'owner-A',kind:'projects',title:'Wedding',contactId:c,
    details:{location:'Studio',additionalClientIds:[],collectionIds:[],privateNotes:[]}};
  const records:any={
    findOne:jest.fn().mockReturnValue(chain(project)),
    find:jest.fn().mockReturnValue(chain([])),
    aggregate:jest.fn().mockResolvedValue([]),
    updateOne:jest.fn().mockResolvedValue({matchedCount:1,modifiedCount:1}),
  };
  const bookings:any={find:jest.fn().mockReturnValue(chain([]))};
  const galleries:any={
    find:jest.fn().mockReturnValue(chain([])),
    findOne:jest.fn().mockReturnValue(chain({_id:g,name:'Wedding gallery'})),
  };
  const service=new StudioProjectService(records as any,bookings as any,galleries as any);
  return {project,records,bookings,galleries,service};
}
describe('Studio Manager project detail overview',()=>{
  it('returns the real owner-scoped records, sessions, notes and gallery options',async()=>{
    const {service,records,bookings,galleries}=fixture();
    records.aggregate.mockResolvedValue([{_id:'BDT',paid:1500,upcoming:300,overdue:0}]);
    const result=await service.overview('owner-A',p);
    expect(result.project.title).toBe('Wedding');
    expect(result.payments[0]).toEqual({currency:'BDT',paid:1500,upcoming:300,overdue:0});
    expect(records.findOne).toHaveBeenCalledWith({userId:'owner-A',kind:'projects',_id:p});
    expect(bookings.find).toHaveBeenCalledWith({userId:'owner-A',projectId:p});
    expect(records.find).toHaveBeenCalledWith({
      userId:'owner-A',kind:{$in:['invoices','documents']},projectId:p,
    });
    expect(records.find).toHaveBeenCalledWith({userId:'owner-A',kind:'messages',projectId:p});
    expect(galleries.find).toHaveBeenCalledWith({userId:'owner-A'});
    expect(records.aggregate.mock.calls[0][0][0]).toEqual({$match:{userId:'owner-A',projectId:p,$or:[
      {kind:'invoices'},
      {kind:'transactions',status:'paid','details.paymentLinkId':{$exists:true}},
    ]}});
  });
  it('rejects projects not owned by the authenticated studio',async()=>{
    const {service,records}=fixture();
    records.findOne.mockReturnValue(chain(null));
    await expect(service.overview('other-owner',p)).rejects.toBeInstanceOf(NotFoundException);
    expect(records.find).not.toHaveBeenCalled();
  });
  it('adds private notes only to the authenticated project',async()=>{
    const {service,records}=fixture();
    const note=await service.addNote('owner-A',p,'Remember blue backdrop');
    expect(note.text).toBe('Remember blue backdrop');
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(records.updateOne).toHaveBeenCalledWith(
      {userId:'owner-A',kind:'projects',_id:p},
      {$push:{'details.privateNotes':{$each:[note],$slice:-100}}},
    );
  });
  it('rejects blank or unreasonably long notes',async()=>{
    const {service,records}=fixture();
    await expect(service.addNote('owner-A',p,'  ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addNote('owner-A',p,'x'.repeat(2001))).rejects.toBeInstanceOf(BadRequestException);
    expect(records.updateOne).not.toHaveBeenCalled();
  });
  it('deletes a private note using an owner-scoped query',async()=>{
    const {service,records}=fixture();
    const result=await service.deleteNote('owner-A',p,noteId);
    expect(result.deleted).toBe(true);
    expect(records.updateOne).toHaveBeenCalledWith(
      {userId:'owner-A',kind:'projects',_id:p},
      {$pull:{'details.privateNotes':{id:noteId}}},
    );
  });
  it('links only galleries belonging to the same studio',async()=>{
    const {service,records,galleries}=fixture();
    const linked=await service.linkGallery('owner-A',p,g);
    expect(linked.name).toBe('Wedding gallery');
    expect(galleries.findOne).toHaveBeenCalledWith({userId:'owner-A',_id:g});
    expect(records.updateOne).toHaveBeenCalledWith(
      {userId:'owner-A',kind:'projects',_id:p},
      {$addToSet:{'details.collectionIds':g}},
    );
    galleries.findOne.mockReturnValue(chain(null));
    await expect(service.linkGallery('owner-A',p,g)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('unlinks a gallery without deleting the collection',async()=>{
    const {service,records,galleries}=fixture();
    expect((await service.unlinkGallery('owner-A',p,g)).unlinked).toBe(true);
    expect(records.updateOne).toHaveBeenCalledWith(
      {userId:'owner-A',kind:'projects',_id:p},
      {$pull:{'details.collectionIds':g}},
    );
    expect(galleries.findOne).not.toHaveBeenCalled();
  });
  it('does not allow a private note to be deleted from another studio',async()=>{
    const {service,records}=fixture();
    records.updateOne.mockResolvedValue({matchedCount:0,modifiedCount:0});
    await expect(service.deleteNote('owner-B',p,noteId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
