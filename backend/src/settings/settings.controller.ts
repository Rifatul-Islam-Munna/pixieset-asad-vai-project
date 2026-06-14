import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { UpsertDashboardSettingDto } from './dto/upsert-dashboard-setting.dto';
import { DashboardSettingType } from './entities/dashboard-setting.entity';
import { SettingsService } from './settings.service';

const settingTypes = Object.values(DashboardSettingType);

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':type')
  async findAll(
    @Param('type') type: DashboardSettingType,
    @Req() req: ExpressRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    this.assertType(type);
    const data = await this.settingsService.findAll(req.user.id, type, collectionId);
    return { data };
  }

  @Post(':type')
  async upsert(
    @Param('type') type: DashboardSettingType,
    @Body() dto: UpsertDashboardSettingDto,
    @Req() req: ExpressRequest,
  ) {
    this.assertType(type);
    const data = await this.settingsService.upsert(req.user.id, type, dto);
    return { message: 'Setting saved', data };
  }

  @Delete(':type/:localId')
  async remove(
    @Param('type') type: DashboardSettingType,
    @Param('localId') localId: string,
    @Req() req: ExpressRequest,
  ) {
    this.assertType(type);
    const data = await this.settingsService.remove(req.user.id, type, localId);
    return { message: 'Setting deleted', data };
  }

  private assertType(type: DashboardSettingType) {
    if (!settingTypes.includes(type)) {
      throw new BadRequestException('Invalid setting type');
    }
  }
}
