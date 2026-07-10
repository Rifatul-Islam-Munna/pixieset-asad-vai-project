import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FreePlanSetting, FreePlanSettingSchema } from './entities/free-plan-setting.entity';
import { FreePlanSettingService } from './free-plan-setting.service';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: FreePlanSetting.name, schema: FreePlanSettingSchema }])],
  providers: [FreePlanSettingService],
  exports: [FreePlanSettingService],
})
export class FreePlanSettingModule {}
