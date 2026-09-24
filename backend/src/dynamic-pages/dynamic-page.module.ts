import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DynamicPageController } from './dynamic-page.controller';
import { DynamicPage, DynamicPageSchema } from './dynamic-page.entity';
import { DynamicPageService } from './dynamic-page.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: DynamicPage.name, schema: DynamicPageSchema }])],
  controllers: [DynamicPageController],
  providers: [DynamicPageService],
})
export class DynamicPageModule {}
