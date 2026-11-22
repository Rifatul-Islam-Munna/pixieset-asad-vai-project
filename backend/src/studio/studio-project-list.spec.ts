import {BadRequestException} from '@nestjs/common';
import {StudioService} from './studio.service';

const id='123456789012345678901234';
function fixture(){
  const listing:any={
    sort:jest.fn().mockReturnThis(),
    skip:jest.fn().mockReturnThis(),
    limit:jest.fn().mockReturnThis(),
    lean:jest.fn().mockResolvedValue([]),
  };
  const existing:any={_id:id,userId:'studio-A',kind:'settings',status:'active',details:{}};
  const model:any={
    find:jest.fn().mockReturnValue(listing),
    countDocuments:jest.fn().mockResolvedValue(124),
    findOne:jest.fn().mockResolvedValue(existing),
    findOneAndUpdate:jest.fn().mockReturnValue({lean:jest.fn().mockResolvedValue(existing)}),
  };
  const service=new StudioService(model as any,{} as any,{} as any);
  return {service,model,listing};
}
describe('Studio project table server-side search and pagination',()=>{
  it('paginates active projects at 20 per page, 0 based Mongo skip',async()=>{
    const {service,model,listing}=fixture();
    const result=await service.list('studio-A','projects',{page:3,limit:20,archived:'false'});
    expect(result).toMatchObject({total:124,page:3,limit:20});
    expect(model.find).toHaveBeenCalledWith(expect.objectContaining({
      userId:'studio-A',kind:'projects',archived:false,
    }));
    expect(listing.skip).toHaveBeenCalledWith(40);
    expect(listing.limit).toHaveBeenCalledWith(20);
  });
  it('searches title, status, project type literally and applies oldest sorting',async()=>{
    const {service,model,listing}=fixture();
    await service.list('studio-A','projects',{search:'photo.*',type:'portrait',sort:'oldest'});
    const filter=model.find.mock.calls[0][0];
    expect(filter).toMatchObject({userId:'studio-A',kind:'projects',type:'portrait'});
    expect(filter.$or).toHaveLength(3);
    const expression=new RegExp(filter.$or[0].title.$regex,'i');
    expect(expression.test('photo.*')).toBe(true);
    expect(expression.test('photo-and-wedding')).toBe(false);
    expect(listing.sort).toHaveBeenCalledWith({createdAt:1});
  });
  it('shows only archived projects in the Archived view',async()=>{
    const {service,model}=fixture();
    await service.list('studio-A','projects',{archived:'true',page:1,limit:10});
    expect(model.find.mock.calls[0][0].archived).toBe(true);
  });
  it('caps page size to avoid unbounded record downloads',async()=>{
    const {service,listing}=fixture();
    await service.list('studio-A','projects',{page:1,limit:100000});
    expect(listing.limit).toHaveBeenCalledWith(250);
  });
});
describe('Project stage title and colour persistence',()=>{
  it('accepts a custom title and validated hex colour',async()=>{
    const {service,model}=fixture();
    await service.update('studio-A','settings',id,{
      details:{projectStages:['inquiry','booked','editing'],
        projectStageLabels:{editing:'Photo Editing'},
        projectStageColors:{editing:'#3A5DBC'}},
    });
    const payload=model.findOneAndUpdate.mock.calls[0][1].$set;
    expect(payload.details.projectStageColors.editing).toBe('#3A5DBC');
    expect(payload.details.projectStageLabels.editing).toBe('Photo Editing');
  });
  it('rejects unsafe colour data and does not persist it',async()=>{
    const {service,model}=fixture();
    await expect(service.update('studio-A','settings',id,{
      details:{projectStageColors:{editing:'javascript:alert(1)'}},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects unsafe stage labels',async()=>{
    const {service,model}=fixture();
    await expect(service.update('studio-A','settings',id,{
      details:{projectStageLabels:{'invalid stage!':'Unsafe'}},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
