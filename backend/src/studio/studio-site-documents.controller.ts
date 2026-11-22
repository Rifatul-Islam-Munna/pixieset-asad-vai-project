import {Controller,Get,Param,UseGuards} from '@nestjs/common';
import {Throttle,ThrottlerGuard} from '@nestjs/throttler';
import {StudioPaymentLinksService} from './studio-payment-links.service';
import {StudioService} from './studio.service';

/** Public, unguessable document links on an enabled tenant-owned subdomain.
 * Draft documents are viewable but cannot submit, sign, accept, or pay. */
@Controller('public/studio/site-documents')
@UseGuards(ThrottlerGuard)
export class StudioSiteDocumentsController {
  constructor(
    private readonly links:StudioPaymentLinksService,
    private readonly studio:StudioService,
  ){}
  @Get(':site/:kind/:token')
  @Throttle({default:{limit:40,ttl:60000}})
  async document(@Param('site') site:string,@Param('kind') kind:string,
    @Param('token') token:string){
    const owner=await this.links.siteOwner(site);
    const result=await this.studio.publicSiteDocument(owner,kind,token);
    const sites=await this.links.ownerSites(owner);
    const studioName=sites.sites.find(value=>value.slug===site)?.name||'Your Studio';
    return {data:{...result,studioName}};
  }
}
