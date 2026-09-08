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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookingSetting.name, schema: BookingSettingSchema },
      { name: BookingService.name, schema: BookingServiceSchema },
      { name: BookingCoworker.name, schema: BookingCoworkerSchema },
      { name: BookingEvent.name, schema: BookingEventSchema },
      { name: BookingShareLink.name, schema: BookingShareLinkSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [BookingsController, PublicBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
