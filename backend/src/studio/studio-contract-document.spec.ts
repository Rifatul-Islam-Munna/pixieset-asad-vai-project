import {BadRequestException, NotFoundException} from '@nestjs/common';
import {contractDocument, contractVariables} from './studio-contract-document';
import {StudioService} from './studio.service';

const recordId='123456789012345678901234';
const projectId='223456789012345678901234';
const clientId='323456789012345678901234';
const token='a'.repeat(64);
const doc={
  type:'doc',
  content:[
    {type:'heading',attrs:{level:1},content:[{type:'text',text:'Photography Agreement'}]},
    {type:'paragraph',content:[
      {type:'text',text:'Client: {{client_name}}'},
      {type:'text',text:' uses '},
      {type:'text',text:'the studio',marks:[{type:'bold'}]},
    ]},
  ],
};
function query(value:any) {return {lean:jest.fn().mockResolvedValue(value)};}
function fixture(){
  const mail={send:jest.fn().mockResolvedValue({sent:true})};
  const record:any={
    _id:recordId,userId:'owner-A',kind:'documents',type:'contract',title:'Portrait Agreement',
    status:'draft',token,projectId,contactId:clientId,email:'jane@example.com',
    details:{contentDoc:doc,content:'Client: {{client_name}}',variables:{client_name:'Jane'}},
    save:jest.fn().mockResolvedValue(undefined),
    toObject:jest.fn(),
  };
  record.toObject.mockImplementation(()=>({...record}));
  const model:any={
    findOne:jest.fn().mockResolvedValue(record),
    findOneAndUpdate:jest.fn().mockReturnValue(query({...record,status:'completed'})),
    create:jest.fn(async(v:any)=>({ ...v, save:jest.fn().mockResolvedValue(undefined), toObject:()=>({_id:recordId,...v}) })),
    exists:jest.fn().mockResolvedValue({_id:projectId}),
  };
  const service=new StudioService(model as any,mail as any,{
    get:(key:string)=>key==='FRONTEND_URL'?'https://gallerista.app':undefined,
  } as any);
  return {service,model,mail,record};
}

describe('Rich contract document protection',()=>{
  it('keeps the supported document structure and allowed formatting',()=>{
    expect(contractDocument(doc)).toEqual(doc);
  });
  it('strips injected attributes even on otherwise allowed nodes',()=>{
    const input={type:'doc',content:[{
      type:'paragraph',onclick:'alert(1)',
      content:[{type:'text',text:'test',onclick:'alert(1)',marks:[{type:'bold',attrs:{onclick:'alert(1)'}}]}],
    }]};
    expect(JSON.stringify(contractDocument(input))).not.toContain('onclick');
  });
  it.each(['script','iframe','image','codeBlock'])('rejects unsafe or unsupported %s nodes',type=>{
    expect(()=>contractDocument({type:'doc',content:[{type}]})).toThrow(BadRequestException);
  });
  it.each(['javascript:alert(1)','data:text/html,hi','file:///etc/passwd'])('rejects unsafe link %s',href=>{
    expect(()=>contractDocument({type:'doc',content:[{type:'paragraph',content:[
      {type:'text',text:'click',marks:[{type:'link',attrs:{href}}]},
    ]}]})).toThrow(BadRequestException);
  });
  it('supports https hyperlinks and keeps only their safe URL',()=>{
    const result=contractDocument({type:'doc',content:[{type:'paragraph',content:[
      {type:'text',text:'details',marks:[{type:'link',attrs:{href:'https://example.com/terms',onclick:'x'}}]},
    ]}]});
    expect(result.content?.[0].content?.[0].marks).toEqual([{type:'link',attrs:{href:'https://example.com/terms'}}]);
  });
  it('rejects overly long contracts',()=>{
    expect(()=>contractDocument({type:'doc',content:[{type:'paragraph',content:[
      {type:'text',text:'x'.repeat(26000)},
    ]}]})).toThrow(BadRequestException);
  });
  it('keeps only supported placeholder variables',()=>{
    expect(contractVariables({client_name:'Jane',photographer_name:'Studio',evil_key:'do not include'}))
      .toMatchObject({client_name:'Jane',photographer_name:'Studio'});
    expect(contractVariables({evil_key:'x'})).not.toHaveProperty('evil_key');
  });
});

describe('Rich Studio contract save, delivery and signing',()=>{
  it('creates a draft with project, client and validated rich content',async()=>{
    const {service,model}=fixture();
    const result=await service.create('owner-A','documents',{
      type:'contract',title:'Portrait Agreement',projectId,contactId:clientId,
      email:'jane@example.com',status:'draft',
      details:{contentDoc:doc,variables:{client_name:'Jane'},
        photographerName:'Studio',clientSignerEmail:'jane@example.com'},
    });
    expect(result.kind).toBe('documents');
    expect(result.projectId).toBe(projectId);
    expect(result.contactId).toBe(clientId);
    expect(result.details.contentDoc.content[0].type).toBe('heading');
    expect(model.exists).toHaveBeenCalledWith({userId:'owner-A',kind:'projects',_id:projectId});
    expect(model.exists).toHaveBeenCalledWith({userId:'owner-A',kind:'contacts',_id:clientId});
  });
  it('refuses to show an unsent draft on the public signing link',async()=>{
    const {service,model}=fixture();
    model.findOne.mockReturnValue(query({kind:'documents',type:'contract',status:'draft',token,details:{contentDoc:doc}}));
    await expect(service.publicContract(token)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('renders validated rich content and preview variables after sending',async()=>{
    const {service,model,record}=fixture();
    model.findOne.mockReturnValue(query({...record,status:'in-progress'}));
    const publicData=await service.publicContract(token);
    expect(publicData.contentDoc).toEqual(doc);
    expect(publicData.variables).toMatchObject({client_name:'Jane'});
  });
  it('sends a stored contract to the client and changes its status',async()=>{
    const {service,model,mail,record}=fixture();
    model.findOne.mockImplementation((filter:any)=>
      filter.kind==='contacts'
        ? {select:()=>query({email:'jane@example.com'})}
        : Promise.resolve(record));
    const result=await service.sendContract('owner-A',recordId);
    expect(result.emailSent).toBe(true);
    expect(result.url).toBe('https://gallerista.app/studio/contract/'+token);
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({to:'jane@example.com'}));
    expect(record.status).toBe('in-progress');
    expect(record.save).toHaveBeenCalledTimes(1);
  });
  it('locks sent contract text to protect what the recipient is acknowledging',async()=>{
    const {service,model,record}=fixture();
    model.findOne.mockResolvedValue({...record,status:'in-progress'});
    await expect(service.update('owner-A','documents',recordId,{
      details:{contentDoc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Changed!'}]}]}},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('retains rich content when applying an owned contract template',async()=>{
    const {service,model}=fixture();
    model.findOne.mockReturnValue(query({
      _id:recordId,userId:'owner-A',kind:'templates',type:'contract',
      title:'Wedding starter',details:{contentDoc:doc,variables:{client_name:'Jane'}},
    }));
    const created=await service.useTemplate('owner-A',recordId,{contactId:clientId,projectId});
    expect(created.details.contentDoc).toEqual(doc);
    expect(created.projectId).toBe(projectId);
  });
  it('creates a reusable rich contract template without requiring a client',async()=>{
    const {service}=fixture();
    const created=await service.create('owner-A','templates',{
      title:'Custom portrait template',type:'contract',status:'active',
      details:{contentDoc:doc,content:'Portrait terms',accentColor:'#6337d8'},
    });
    expect(created.kind).toBe('templates');
    expect(created.details.contentDoc).toEqual(doc);
  });
  it('allows editing an existing active rich contract template',async()=>{
    const {service,model}=fixture();
    model.findOne.mockResolvedValue({
      _id:recordId,userId:'owner-A',kind:'templates',type:'contract',status:'active',details:{},
    });
    model.findOneAndUpdate.mockReturnValue(query({_id:recordId,kind:'templates',type:'contract',
      status:'active',details:{contentDoc:doc}}));
    const updated=await service.update('owner-A','templates',recordId,{
      title:'Updated portrait template',type:'contract',status:'active',details:{contentDoc:doc},
    });
    expect(updated?.details?.contentDoc).toEqual(doc);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {_id:recordId,userId:'owner-A',kind:'templates'},
      {$set:expect.objectContaining({title:'Updated portrait template'})},
      expect.objectContaining({runValidators:true}),
    );
  });
});
