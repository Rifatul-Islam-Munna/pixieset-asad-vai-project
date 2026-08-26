import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollectionEmailRegistration, CollectionEmailRegistrationSchema } from 'src/collections/entities/collection-email-registration.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { MarketingEmailSchedule, MarketingEmailScheduleSchema } from './entities/marketing-email-schedule.entity';
import { MarketingScheduleController } from './marketing-schedule.controller';
import { MarketingScheduleService } from './marketing-schedule.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketingEmailSchedule.name, schema: MarketingEmailScheduleSchema },
      { name: CollectionEmailRegistration.name, schema: CollectionEmailRegistrationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MarketingScheduleController],
  providers: [MarketingScheduleService],
})
export class MarketingScheduleModule {}
