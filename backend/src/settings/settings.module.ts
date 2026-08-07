import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DashboardSetting,
  DashboardSettingSchema,
} from './entities/dashboard-setting.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { User, UserSchema } from 'src/user/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
