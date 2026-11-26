import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/entities/user.entity';
import { Plan, PlanSchema } from '../admin/entities/plan.entity';
import { FreePlanSetting, FreePlanSettingSchema } from '../admin/entities/free-plan-setting.entity';
import { FreePlanSettingService } from '../admin/free-plan-setting.service';
import { StudioRecord, StudioRecordSchema } from './studio-record.entity';
import { BookingService, BookingServiceSchema } from '../bookings/entities/booking-service.entity';
import { StudioSubscriptionService } from './studio-subscription.service';

@Module({
  imports:[MongooseModule.forFeature([
    {name:User.name,schema:UserSchema}, {name:Plan.name,schema:PlanSchema},
    {name:FreePlanSetting.name,schema:FreePlanSettingSchema}, {name:StudioRecord.name,schema:StudioRecordSchema},
    {name:BookingService.name,schema:BookingServiceSchema},
  ])],
  providers:[FreePlanSettingService,StudioSubscriptionService],
  exports:[StudioSubscriptionService],
})
export class StudioSubscriptionModule {}
