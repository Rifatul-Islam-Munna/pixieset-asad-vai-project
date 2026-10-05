import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardSetting, DashboardSettingSchema } from 'src/settings/entities/dashboard-setting.entity';
import { HomeCms, HomeCmsSchema } from '../home-cms/entities/home-cms.entity';
import { BrandingEmailService } from './branding-email.service';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DashboardSetting.name, schema: DashboardSettingSchema },
      { name: HomeCms.name, schema: HomeCmsSchema },
    ]),
  ],
  controllers: [MailController],
  providers: [MailService, BrandingEmailService],
  exports: [MailService, BrandingEmailService],
})
export class MailModule {}
