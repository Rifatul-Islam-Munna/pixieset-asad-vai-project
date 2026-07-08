import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { Roles } from 'src/lib/roles.decorator';
import { RolesGuard } from 'src/lib/roles.guard';
import { StoreDefaultProductService } from 'src/store/store-default-product.service';
import { UserType } from 'src/user/entities/user.entity';
import { AdminService } from './admin.service';
import { AdminCreatePlanDto, AdminUpdatePlanDto } from './dto/admin-plan.dto';
import { AdminStripeSettingDto } from './dto/admin-stripe-setting.dto';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/admin-user.dto';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserType.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly defaultProducts: StoreDefaultProductService,
  ) {}

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

  @Post('collections/:id/reindex-faces')
  async reindexCollectionFaces(@Param('id') id: string) {
    const data = await this.adminService.reindexCollectionFaces(id);
    return { message: 'Collection faces reindexed', data };
  }

  @Get('default-store-products')
  async defaultStoreProducts() {
    const data = await this.defaultProducts.list();
    return { data };
  }

  @Post('default-store-products')
  async createDefaultStoreProduct(@Body() dto: Record<string, unknown>) {
    const data = await this.defaultProducts.create(dto);
    return { message: 'Default product created', data };
  }

  @Patch('default-store-products/:id')
  async updateDefaultStoreProduct(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    const data = await this.defaultProducts.update(id, dto);
    return { message: 'Default product updated', data };
  }

  @Delete('default-store-products/:id')
  async deleteDefaultStoreProduct(@Param('id') id: string) {
    const data = await this.defaultProducts.remove(id);
    return { message: 'Default product deleted', data };
  }

  @Get('plans')
  async plans() {
    const data = await this.adminService.findPlans();
    return { data };
  }

  @Post('plans')
  async createPlan(@Body() dto: AdminCreatePlanDto) {
    const data = await this.adminService.createPlan(dto);
    return { message: 'Plan created', data };
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() dto: AdminUpdatePlanDto) {
    const data = await this.adminService.updatePlan(id, dto);
    return { message: 'Plan updated', data };
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string) {
    const data = await this.adminService.deletePlan(id);
    return { message: 'Plan deleted', data };
  }

  @Get('stripe')
  async stripeSettings() {
    const data = await this.adminService.getStripeSettings();
    return { data };
  }

  @Patch('stripe')
  async updateStripeSettings(@Body() dto: AdminStripeSettingDto) {
    const data = await this.adminService.updateStripeSettings(dto);
    return { message: 'Stripe settings saved', data };
  }
}
