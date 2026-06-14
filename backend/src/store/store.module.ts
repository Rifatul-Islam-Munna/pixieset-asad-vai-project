import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorePriceSheet, StorePriceSheetSchema } from './entities/store-price-sheet.entity';
import { StoreProduct, StoreProductSchema } from './entities/store-product.entity';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StorePriceSheet.name, schema: StorePriceSheetSchema },
      { name: StoreProduct.name, schema: StoreProductSchema },
    ]),
  ],
  controllers: [StoreController],
  providers: [StoreService],
})
export class StoreModule {}
