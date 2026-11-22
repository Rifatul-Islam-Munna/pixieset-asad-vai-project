import {BadRequestException,GoneException} from '@nestjs/common';
import {validateStudioSignature} from './studio-signature';
import {StudioService} from './studio.service';

const id='123456789012345678901234';
const token='f'.repeat(64);
const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Signed agreement'}]}]};
const variables={client_name:'Jane',photographer_name:'Studio Owner'};
const drawn={kind:'drawn',strokes:[[[30,100],[50,85],[60,80],[90,77]]]};
function chain(value:any){return {lean:jest.fn().mockResolvedValue(value)};}
function fixture(){
  const record:any={
    _id:id,userId:'studio-owner',kind:'documents',type:'contract',
    title:'Photo session agreement',description:'',status:'draft',token,
    details:{contentDoc:doc,variables,content:'Signed agreement'},
  };
  const model:any={
    findOne:jest.fn().mockResolvedValue(record),
    findOneAndUpdate:jest.fn().mockImplementation((filter:any,payload:any)=>chain({
      ...record,...payload.$set,
    })),
    exists:jest.fn().mockResolvedValue({_id:id}),
  };
  const service=new StudioService(model,{} as any,{} as any);
  return {record,model,service};
}
describe('Studio drawn and typed signatures',()=>{
  it('keeps a bounded draw path that is rendered without SVG text injection',()=>{
    expect(validateStudioSignature(drawn)).toEqual(drawn);
  });
  it('validates a typed signature',()=>{
    expect(validateStudioSignature({kind:'typed',name:'  Jane Doe  '}))
      .toEqual({kind:'typed',name:'Jane Doe'});
    expect(()=>validateStudioSignature({kind:'typed',name:''})).toThrow(BadRequestException);
  });
  it('accepts an uploaded HTTPS raster signature image and rejects unsafe image URLs',()=>{
    expect(validateStudioSignature({kind:'image',url:'https://cdn.example.com/signatures/owner.png'}))
      .toEqual({kind:'image',url:'https://cdn.example.com/signatures/owner.png'});
    expect(validateStudioSignature({kind:'image',url:'http://localhost:9000/signatures/owner.png'}))
      .toEqual({kind:'image',url:'http://localhost:9000/signatures/owner.png'});
    expect(()=>validateStudioSignature({kind:'image',url:'http://example.com/signature.png'})).toThrow(BadRequestException);
    expect(()=>validateStudioSignature({kind:'image',url:'javascript:alert(1)'})).toThrow(BadRequestException);
    expect(()=>validateStudioSignature({kind:'image',url:'https://example.com/signature.svg'})).toThrow(BadRequestException);
    expect(()=>validateStudioSignature({kind:'image',url:'data:image/png;base64,abc'})).toThrow(BadRequestException);
  });
  it('rejects external images, unsafe coordinates and oversized paths',()=>{
    expect(()=>validateStudioSignature({kind:'svg',image:'<script />'}))
      .toThrow(BadRequestException);
    expect(()=>validateStudioSignature({kind:'drawn',strokes:[[[30,40],[700,50]]]}))
      .toThrow(BadRequestException);
    expect(()=>validateStudioSignature({kind:'drawn',strokes:[Array.from({length:241},()=>[1,2])]}))
      .toThrow(BadRequestException);
    expect(()=>validateStudioSignature({kind:'drawn',strokes:[[[20,20],[30,NaN]]]}))
      .toThrow(BadRequestException);
  });
  it('validates and stores a reusable studio signature on a contract template',async()=>{
    const {record,service,model}=fixture();
    record.kind='templates';record.status='active';
    const image={kind:'image',url:'https://cdn.example.com/signatures/owner.png'};
    await service.update('studio-owner','templates',id,{
      title:'Photography Template',type:'contract',
      details:{contentDoc:doc,defaultStudioSignature:image},
    }) as any;
    const details=model.findOneAndUpdate.mock.calls[0][1].$set.details;
    expect(details.defaultStudioSignature).toEqual(image);
    expect(details.defaultStudioSignature).toEqual(validateStudioSignature(image));
  });
  it('validates and stores a prefilled owner signature on a new contract draft',async()=>{
    const {service,model}=fixture();
    const image={kind:'image',url:'https://cdn.example.com/signatures/owner.png'};
    await service.update('studio-owner','documents',id,{
      title:'Photo session agreement',type:'contract',
      details:{contentDoc:doc,variables,studioSignature:null,studioSignatureDraft:image},
    });
    const details=model.findOneAndUpdate.mock.calls[0][1].$set.details;
    expect(details.studioSignatureDraft).toEqual(image);
    expect(details.studioSignature).toBeNull();
  });
  it('allows studio owner to sign an authenticated draft without marking it complete',async()=>{
    const {model,service}=fixture();
    const result=await service.update('studio-owner','documents',id,{
      title:'Photo session agreement',type:'contract',
      details:{contentDoc:doc,variables,studioSignature:drawn,studioSignerName:'Studio Owner'},
    }) as any;
    expect(result.status).toBe('draft');
    const details=model.findOneAndUpdate.mock.calls[0][1].$set.details;
    expect(details.studioSignature).toEqual(drawn);
    expect(details.studioSignerName).toBe('Studio Owner');
    expect(details.studioSignedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
  it('requires removing the studio signature before changing signed contract text',async()=>{
    const {record,service,model}=fixture();
    record.details.studioSignature=drawn;
    record.details.studioSignerName='Studio Owner';
    record.details.studioSignedAt='2026-11-21T18:00:00.000Z';
    await expect(service.update('studio-owner','documents',id,{
      title:record.title,type:'contract',
      details:{contentDoc:{type:'doc',content:[]},variables,studioSignature:drawn,
        studioSignerName:'Studio Owner'},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    const result=await service.update('studio-owner','documents',id,{
      title:record.title,type:'contract',details:{
        contentDoc:doc,variables,studioSignature:null,studioSignerName:'',
      },
    }) as any;
    expect(result.details.studioSignature).toBeNull();
    expect(result.details.studioSignedAt).toBe('');
  });
  it('rejects replacing an existing studio signature without an explicit removal',async()=>{
    const {record,service,model}=fixture();
    record.details.studioSignature=drawn;
    record.details.studioSignerName='Studio Owner';
    record.details.studioSignedAt='2026-11-21T18:00:00.000Z';
    await expect(service.update('studio-owner','documents',id,{
      title:record.title,type:'contract',details:{
        contentDoc:doc,variables,
        studioSignature:{kind:'typed',name:'Another signer'},
        studioSignerName:'Studio Owner',
      },
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('preserves the timestamp while saving unchanged signed terms',async()=>{
    const {record,service,model}=fixture();
    record.details.studioSignature=drawn;
    record.details.studioSignerName='Studio Owner';
    record.details.studioSignedAt='2026-11-21T18:00:00.000Z';
    await service.update('studio-owner','documents',id,{
      title:record.title,type:'contract',details:{
        contentDoc:doc,variables,studioSignature:drawn,studioSignerName:'Studio Owner',
      },
    });
    const details=model.findOneAndUpdate.mock.calls[0][1].$set.details;
    expect(details.studioSignedAt).toBe(record.details.studioSignedAt);
  });
  it('records a client-drawn signature independently after real client acceptance',async()=>{
    const {record,model,service}=fixture();
    record.status='in-progress';
    record.details.studioSignature=drawn;
    record.details.studioSignerName='Studio Owner';
    const clientSignature={kind:'typed',name:'Jane Doe'};
    const result=await service.signContract(token,{
      signerName:'Jane Doe',accept:true,signature:clientSignature,
    });
    expect(result.signed).toBe(true);
    const details=model.findOneAndUpdate.mock.calls[0][1].$set.details;
    expect(details.clientSignature).toEqual(clientSignature);
    expect(details.studioSignature).toEqual(drawn);
    expect(details.signerName).toBe('Jane Doe');
  });
  it('never records an invalid client signature or duplicate client acceptance',async()=>{
    const {record,model,service}=fixture();
    record.status='in-progress';
    await expect(service.signContract(token,{
      signerName:'Jane Doe',accept:true,signature:{kind:'drawn',strokes:[[[999,999],[2,3]]]},
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    model.findOneAndUpdate.mockReturnValue(chain(null));
    await expect(service.signContract(token,{
      signerName:'Jane Doe',accept:true,signature:drawn,
    })).rejects.toBeInstanceOf(GoneException);
  });
  it('includes both verified signatures on the public completed agreement',async()=>{
    const {record,model,service}=fixture();
    record.status='completed';
    record.details.studioSignature=drawn;
    record.details.studioSignerName='Studio Owner';
    record.details.clientSignature={kind:'typed',name:'Jane Doe'};
    model.findOne.mockReturnValue(chain(record));
    const result=await service.publicContract(token);
    expect(result.studioSignature).toEqual(drawn);
    expect(result.clientSignature).toEqual({kind:'typed',name:'Jane Doe'});
  });
});
