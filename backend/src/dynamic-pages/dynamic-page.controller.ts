import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/lib/auth.guard';
import { Roles } from 'src/lib/roles.decorator';
import { RolesGuard } from 'src/lib/roles.guard';
import { UserType } from 'src/user/entities/user.entity';
import { CreateDynamicPageDto, UpdateDynamicPageDto } from './dynamic-page.dto';
import { DynamicPageService } from './dynamic-page.service';

@Controller('dynamic-pages')
export class DynamicPageController {
  constructor(private readonly pages: DynamicPageService) {}

  @Get() async list() { return { data: await this.pages.publicList() }; }

  @Get('admin/all')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async adminList() { return { data: await this.pages.adminList() }; }

  @Post('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async create(@Body() dto: CreateDynamicPageDto) { return { data: await this.pages.create(dto) }; }

  @Patch('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateDynamicPageDto) { return { data: await this.pages.update(id, dto) }; }
  @Delete('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async remove(@Param('id') id: string) { return { data: await this.pages.remove(id) }; }

  @Get('sitemap/all')
  async sitemapList() { return { data: await this.pages.sitemapList() }; }

  @Get(':slug')
  async one(@Param('slug') slug: string) { return { data: await this.pages.publicOne(slug) }; }
}
