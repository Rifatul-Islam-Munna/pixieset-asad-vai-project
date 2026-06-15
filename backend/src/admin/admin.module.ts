import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Collection, CollectionSchema } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BillingController } from './billing.controller';
import { AdminStripeSetting, AdminStripeSettingSchema } from './entities/admin-stripe-setting.entity';
import { Plan, PlanSchema } from './entities/plan.entity';
import { StoreOrder, StoreOrderSchema } from 'src/store/entities/store-order.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: AdminStripeSetting.name, schema: AdminStripeSettingSchema },
      { name: StoreOrder.name, schema: StoreOrderSchema },
    ]),
  ],
  controllers: [AdminController, BillingController],
  providers: [AdminService],
})
export class AdminModule {}
