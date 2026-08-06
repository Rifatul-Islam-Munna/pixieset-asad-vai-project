import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/lib/auth.guard';
import { Roles } from 'src/lib/roles.decorator';
import { RolesGuard } from 'src/lib/roles.guard';
import { UserType } from 'src/user/entities/user.entity';
import { CreateBlogDto, UpdateBlogDto } from './blog.dto';
import { BlogService } from './blog.service';

@Controller('blogs')
export class BlogController {
  constructor(private readonly blogs: BlogService) {}

  @Get() async list() { return { data: await this.blogs.publicList() }; }

  @Get('admin/all')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async adminList() { return { data: await this.blogs.adminList() }; }

  @Post('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async create(@Body() dto: CreateBlogDto) { return { data: await this.blogs.create(dto) }; }

  @Patch('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateBlogDto) { return { data: await this.blogs.update(id, dto) }; }

  @Delete('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async remove(@Param('id') id: string) { return { data: await this.blogs.remove(id) }; }

  @Get(':slug')
  async one(@Param('slug') slug: string) { return { data: await this.blogs.publicOne(slug) }; }
}
