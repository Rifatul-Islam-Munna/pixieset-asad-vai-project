import {BadRequestException} from '@nestjs/common';

export type StudioSignature =
  | {kind:'typed';name:string}
  | {kind:'drawn';strokes:number[][][]}
  | {kind:'image';url:string};

/** Accept bounded draw paths, typed names, or HTTPS raster images from the authenticated asset uploader. */
export function validateStudioSignature(value:unknown):StudioSignature{
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new BadRequestException('Signature is required');
  const raw=value as Record<string,unknown>;
  if(raw.kind==='typed'){
    if(typeof raw.name!=='string'||raw.name.trim().length<2||raw.name.length>120)
      throw new BadRequestException('Type a valid signature name');
    return {kind:'typed',name:raw.name.trim()};
  }
  if(raw.kind==='image'){
    if(typeof raw.url!=='string'||raw.url.length>2048)
      throw new BadRequestException('Upload a valid signature image');
    let parsed:URL;
    try{parsed=new URL(raw.url);}catch{throw new BadRequestException('Upload a valid signature image');}
    const secureProtocol=parsed.protocol==='https:'||(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname));
    if(!secureProtocol||parsed.username||parsed.password||parsed.search||parsed.hash||
      !/\.(png|jpe?g|webp|avif)$/i.test(parsed.pathname))
      throw new BadRequestException('Signature images must be uploaded PNG, JPG, WebP or AVIF files');
    return {kind:'image',url:parsed.toString()};
  }
  if(raw.kind!=='drawn'||!Array.isArray(raw.strokes)||
    raw.strokes.length<1||raw.strokes.length>20)
    throw new BadRequestException('Draw or type your signature');
  let points=0;
  const strokes=raw.strokes.map((stroke:unknown)=>{
    if(!Array.isArray(stroke)||stroke.length<2||stroke.length>240)
      throw new BadRequestException('Signature stroke is invalid');
    points+=stroke.length;
    if(points>1800)throw new BadRequestException('Signature drawing is too complex');
    return stroke.map((point:unknown)=>{
      if(!Array.isArray(point)||point.length!==2||
        point.some(x=>typeof x!=='number'||!Number.isInteger(x)||x<0))
        throw new BadRequestException('Invalid signature coordinates');
      if(point[0]>600||point[1]>160)
        throw new BadRequestException('Invalid signature coordinates');
      return [point[0],point[1]];
    });
  });
  return {kind:'drawn',strokes};
}
