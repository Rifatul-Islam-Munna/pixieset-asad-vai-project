import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImageUploadModule } from './image-upload/image-upload.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { SettingsModule } from './settings/settings.module';
import { CollectionsModule } from './collections/collections.module';
import { StoreModule } from './store/store.module';
import { AdminModule } from './admin/admin.module';
import { HomeCmsModule } from './home-cms/home-cms.module';
import { MobileGalleryModule } from './mobile-gallery/mobile-gallery.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('ACCESS_TOKEN') ?? 'dev-secret',
        signOptions: { expiresIn: '10d' },
      }),
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URL ?? 'mongodb://127.0.0.1:27017/pixieset-asad-vai-project',
      { autoIndex: true },
    ),
    UserModule,
    SettingsModule,
    CollectionsModule,
    ImageUploadModule,
    StoreModule,
    AdminModule,
    HomeCmsModule,
    MobileGalleryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
