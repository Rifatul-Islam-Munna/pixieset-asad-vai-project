import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeCms, HomeCmsSchema } from './entities/home-cms.entity';
import { HomeCmsController } from './home-cms.controller';
import { HomeCmsService } from './home-cms.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: HomeCms.name, schema: HomeCmsSchema }])],
  controllers: [HomeCmsController],
  providers: [HomeCmsService],
})
export class HomeCmsModule {}
