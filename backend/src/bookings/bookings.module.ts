import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { BookingCoworker, BookingCoworkerSchema } from './entities/booking-coworker.entity';
import { BookingEvent, BookingEventSchema } from './entities/booking-event.entity';
import { BookingService, BookingServiceSchema } from './entities/booking-service.entity';
import { BookingSetting, BookingSettingSchema } from './entities/booking-setting.entity';
import { BookingShareLink, BookingShareLinkSchema } from './entities/booking-share-link.entity';
import { BookingsController, PublicBookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { StudioRecord, StudioRecordSchema } from '../studio/studio-record.entity';
import { Homepage, HomepageSchema } from 'src/homepage/entities/homepage.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookingSetting.name, schema: BookingSettingSchema },
      { name: BookingService.name, schema: BookingServiceSchema },
      { name: BookingCoworker.name, schema: BookingCoworkerSchema },
      { name: BookingEvent.name, schema: BookingEventSchema },
      { name: BookingShareLink.name, schema: BookingShareLinkSchema },
      { name: StudioRecord.name, schema: StudioRecordSchema },
      { name: User.name, schema: UserSchema },
      { name: Homepage.name, schema: HomepageSchema },
    ]),
  ],
  controllers: [BookingsController, PublicBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
