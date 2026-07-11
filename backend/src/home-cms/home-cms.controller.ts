import { Body, Controller, Get, Header, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/lib/auth.guard';
import { Roles } from 'src/lib/roles.decorator';
import { RolesGuard } from 'src/lib/roles.guard';
import { UserType } from 'src/user/entities/user.entity';
import { UpdateHomeCmsDto } from './dto/update-home-cms.dto';
import { HomeCmsService } from './home-cms.service';

@Controller('home-cms')
export class HomeCmsController {
  constructor(private readonly homeCmsService: HomeCmsService) {}

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0')
  @Header('CDN-Cache-Control', 'no-store')
  async publicHomeCms() {
    const data = await this.homeCmsService.getHomeCms();
    return { data };
  }

  @Patch()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async updateHomeCms(@Body() dto: UpdateHomeCmsDto) {
    const data = await this.homeCmsService.updateHomeCms(dto);
    return { message: 'Home CMS saved', data };
  }
}
