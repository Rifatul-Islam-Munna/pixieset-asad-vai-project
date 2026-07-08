import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { UpdateHomepageDto } from './dto/update-homepage.dto';
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
