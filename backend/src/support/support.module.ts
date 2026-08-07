import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/entities/user.entity';
import { SupportController } from './support.controller';
import { SupportGateway } from './support.gateway';
import { SupportMessage, SupportMessageSchema } from './entities/support-message.entity';
import { SupportService } from './support.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: SupportMessage.name, schema: SupportMessageSchema },
    { name: User.name, schema: UserSchema },
  ])],
  controllers: [SupportController],
  providers: [SupportService, SupportGateway],
  exports: [SupportService],
})
export class SupportModule {}
