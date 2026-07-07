import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorePriceSheet, StorePriceSheetSchema } from './entities/store-price-sheet.entity';
import { StoreProduct, StoreProductSchema } from './entities/store-product.entity';
import { StoreCoupon, StoreCouponSchema } from './entities/store-coupon.entity';
import { StoreCustomer, StoreCustomerSchema } from './entities/store-customer.entity';
import { StoreOrder, StoreOrderSchema } from './entities/store-order.entity';
import { StoreShipping, StoreShippingSchema } from './entities/store-shipping.entity';
import { StoreSetting, StoreSettingSchema } from './entities/store-setting.entity';
import { StoreTax, StoreTaxSchema } from './entities/store-tax.entity';
import { StoreActivity, StoreActivitySchema } from './entities/store-activity.entity';
import { PublicCollectionStoreController, PublicStoreController, StoreController } from './store.controller';
import { StoreService } from './store.service';
import { PublicStoreService } from './public-store.service';
import { StoreCatalogService } from './store-catalog.service';
import { StorePricingService } from './store-pricing.service';
import { StoreStripeService } from './store-stripe.service';
import { StoreOrderCreateService } from './store-order-create.service';
import { StorePaymentVerifyService } from './store-payment-verify.service';
import { Collection, CollectionSchema } from 'src/collections/entities/collection.entity';
import { CollectionImage, CollectionImageSchema } from 'src/collections/entities/collection-image.entity';
import { User, UserSchema } from 'src/user/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StorePriceSheet.name, schema: StorePriceSheetSchema },
      { name: StoreProduct.name, schema: StoreProductSchema },
      { name: StoreOrder.name, schema: StoreOrderSchema },
      { name: StoreCustomer.name, schema: StoreCustomerSchema },
      { name: StoreCoupon.name, schema: StoreCouponSchema },
      { name: StoreTax.name, schema: StoreTaxSchema },
      { name: StoreShipping.name, schema: StoreShippingSchema },
      { name: StoreSetting.name, schema: StoreSettingSchema },
      { name: StoreActivity.name, schema: StoreActivitySchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: CollectionImage.name, schema: CollectionImageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [StoreController, PublicStoreController, PublicCollectionStoreController],
  providers: [
    StoreService,
    PublicStoreService,
    StoreCatalogService,
    StorePricingService,
    StoreStripeService,
    StoreOrderCreateService,
    StorePaymentVerifyService,
  ],
})
export class StoreModule {}
