import {
  BadRequestException,Controller,Get,Param,Post,Req,UploadedFile,
  UseGuards,UseInterceptors,Body,
} from '@nestjs/common';
import {Throttle,ThrottlerGuard} from '@nestjs/throttler';
import {AuthGuard,type ExpressRequest} from '../lib/auth.guard';
import {FileInterceptor} from '@nestjs/platform-express';
import {diskStorage} from 'multer';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {extname} from 'node:path';
import {unlink} from 'node:fs/promises';
import {MinioService} from '../lib/minio.service';
import {StudioPaymentLinksService} from './studio-payment-links.service';

const acceptedImages=new Set(['image/jpeg','image/png','image/webp','image/avif']);
const imageOptions={
  storage:diskStorage({
    destination:tmpdir(),
    filename:(_request:any,file:Express.Multer.File,callback:(error:Error|null,name:string)=>void)=>{
      const ext=extname(file.originalname).toLowerCase();
      const safe=['.jpg','.jpeg','.png','.webp','.avif'].includes(ext)?ext:'.jpg';
      callback(null,'studio-link-cover-'+randomUUID()+safe);
    },
  }),
  limits:{fileSize:5*1024*1024,files:1},
  fileFilter:(_request:any,file:Express.Multer.File,callback:(error:Error|null,accept:boolean)=>void)=>{
    if(!acceptedImages.has(file.mimetype))
      return callback(new BadRequestException('Upload a JPEG, PNG, WebP or AVIF image under 5 MB'),false);
    callback(null,true);
  },
};

@Controller('studio/payment-links')
@UseGuards(AuthGuard,ThrottlerGuard)
export class StudioPaymentLinksController {
  constructor(
    private readonly links:StudioPaymentLinksService,
    private readonly storage:MinioService,
  ) {}

  @Get('sites')
  async sites(@Req() request:ExpressRequest){
    return {data:await this.links.ownerSites(request.user.id)};
  }

  @Post('cover-image')
  @Throttle({default:{limit:10,ttl:60000}})
  @UseInterceptors(FileInterceptor('file',imageOptions))
  async coverImage(@UploadedFile() file:Express.Multer.File){
    if(!file?.path)throw new BadRequestException('Select an image');
    try{
      const url=await this.storage.uploadFile(file);
      return {data:{url}};
    }finally{
      await unlink(file.path).catch(()=>undefined);
    }
  }
}

@Controller('public/studio/payment-links')
@UseGuards(ThrottlerGuard)
export class PublicStudioPaymentLinksController {
  constructor(private readonly links:StudioPaymentLinksService){}

  @Get('site/:site/:slug')
  async bySite(@Param('site') site:string,@Param('slug') slug:string){
    return {data:await this.links.linkBySite(site,slug)};
  }

  @Get(':token/details')
  async details(@Param('token') token:string){
    return {data:await this.links.publicLink(token)};
  }

  @Post(':token/checkout')
  @Throttle({default:{limit:5,ttl:60000}})
  async checkout(@Param('token') token:string,@Body() body:Record<string,unknown>){
    return {data:await this.links.checkout(token,body)};
  }

  @Post(':token/verify')
  @Throttle({default:{limit:10,ttl:60000}})
  async verify(@Param('token') token:string,
    @Body() body:{provider:'stripe'|'paypal';referenceId:string}){
    return {data:await this.links.verify(token,body.provider,body.referenceId)};
  }
}
