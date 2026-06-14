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
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

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
    ]),
  ],
  controllers: [StoreController],
  providers: [StoreService],
})
export class StoreModule {}
