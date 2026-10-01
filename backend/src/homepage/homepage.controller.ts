import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { UpdateHomepageDto } from './dto/update-homepage.dto';
import { CreateHomepageSubdomainDto, UpdateHomepageSubdomainDto } from './dto/homepage-subdomain.dto';
import { HomepageService } from './homepage.service';

@Controller('homepages')
@UseGuards(AuthGuard)
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get('me')
  async mine(@Req() req: ExpressRequest) {
    const data = await this.homepageService.getMine(req.user.id);
    return { data };
  }

  @Patch('me')
  async updateMine(@Req() req: ExpressRequest, @Body() dto: UpdateHomepageDto) {
    const data = await this.homepageService.updateMine(req.user.id, dto);
    return { message: 'Homepage saved', data };
  }

  @Post('me/subdomains')
  async createSubdomain(@Req() req: ExpressRequest, @Body() dto: CreateHomepageSubdomainDto) {
    const data = await this.homepageService.createSubdomain(req.user.id, dto);
    return { message: 'Subdomain created', data };
  }

  @Patch('me/subdomains/:siteId')
  async updateSubdomain(@Req() req: ExpressRequest, @Param('siteId') siteId: string, @Body() dto: UpdateHomepageSubdomainDto) {
    const data = await this.homepageService.updateSubdomain(req.user.id, siteId, dto);
    return { message: 'Subdomain saved', data };
  }

  @Delete('me/subdomains/:siteId')
  async deleteSubdomain(@Req() req: ExpressRequest, @Param('siteId') siteId: string) {
    const data = await this.homepageService.deleteSubdomain(req.user.id, siteId);
    return { message: 'Subdomain deleted', data };
  }
}

@Controller('public/homepages')
export class PublicHomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get(':slug')
  async findOne(
    @Param('slug') slug: string,
    @Query('password') password?: string,
  ) {
    const data = await this.homepageService.getPublic(slug, password);
    return { data };
  }
}
