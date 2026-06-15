import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { Roles } from 'src/lib/roles.decorator';
import { RolesGuard } from 'src/lib/roles.guard';
import { UserType } from 'src/user/entities/user.entity';
import { AdminService } from './admin.service';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/admin-user.dto';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserType.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async dashboard() {
    const data = await this.adminService.dashboard();
    return { data };
  }

  @Get('users')
  async users() {
    const data = await this.adminService.findUsers();
    return { data };
  }

  @Post('users')
  async createUser(@Body() dto: AdminCreateUserDto) {
    const data = await this.adminService.createUser(dto);
    return { message: 'User created', data };
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    const data = await this.adminService.updateUser(id, dto);
    return { message: 'User updated', data };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Req() req: ExpressRequest) {
    const data = await this.adminService.deleteUser(id, req.user.id);
    return { message: 'User deleted', data };
  }

  @Get('collections')
  async collections(@Query('userId') userId?: string) {
    const data = await this.adminService.findCollections(userId);
    return { data };
  }

  @Delete('collections/:id')
  async deleteCollection(@Param('id') id: string) {
    const data = await this.adminService.deleteCollection(id);
    return { message: 'Collection deleted', data };
  }
}
