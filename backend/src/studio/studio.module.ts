import { Module } from '@nestjs/common';
import { StudioSubscriptionModule } from './studio-subscription.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { StudioRecord, StudioRecordSchema } from './studio-record.entity';
import { PublicStudioController, StudioController } from './studio.controller';
import { StudioService } from './studio.service';
import { StudioCalendarFeed, StudioCalendarFeedSchema } from './studio-calendar-feed.entity';
import { BookingEvent, BookingEventSchema } from '../bookings/entities/booking-event.entity';
import { StudioCalendarService } from './studio-calendar.service';
import { StudioCalendarController, StudioPublicCalendarController } from './studio-calendar.controller';
import { Collection, CollectionSchema } from '../collections/entities/collection.entity';
import { StudioProjectService } from './studio-project.service';
import { StudioProjectController } from './studio-project.controller';
import { StoreSetting, StoreSettingSchema } from '../store/entities/store-setting.entity';
import { StudioPaymentsService } from './studio-payments.service';
import { PublicStudioPaymentsController, StudioPaymentsController } from './studio-payments.controller';
import { Homepage, HomepageSchema } from '../homepage/entities/homepage.entity';
import { MinioService } from '../lib/minio.service';
import { StudioPaymentLinksService } from './studio-payment-links.service';
import { PublicStudioPaymentLinksController, StudioPaymentLinksController } from './studio-payment-links.controller';
import {StudioSiteDocumentsController} from './studio-site-documents.controller';

@Module({
  imports: [
    StudioSubscriptionModule,
    MongooseModule.forFeature([
      { name: StudioRecord.name, schema: StudioRecordSchema },
      { name: StoreSetting.name, schema: StoreSettingSchema },
      { name: Homepage.name, schema: HomepageSchema },
      { name: StudioCalendarFeed.name, schema: StudioCalendarFeedSchema },
      { name: BookingEvent.name, schema: BookingEventSchema },
      { name: Collection.name, schema: CollectionSchema },
    ]),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  ],
  // Register the static /studio/calendar-sync route before StudioController's /studio/:kind catch-all.
  controllers: [StudioCalendarController, StudioPublicCalendarController, StudioProjectController,
    StudioPaymentsController, PublicStudioPaymentsController,
    StudioPaymentLinksController, PublicStudioPaymentLinksController,
    StudioSiteDocumentsController,StudioController, PublicStudioController],
  providers: [StudioService, StudioCalendarService, StudioProjectService, StudioPaymentsService,
    StudioPaymentLinksService, MinioService],
})
export class StudioModule {}
