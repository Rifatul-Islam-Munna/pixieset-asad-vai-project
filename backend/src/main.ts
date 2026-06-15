import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, raw, static as serveStatic, urlencoded } from 'express';
import { join } from 'path';
import { cwd } from 'process';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', credentials: true });
  app.use('/uploads', serveStatic(join(cwd(), 'uploads')));
  app.use('/billing/stripe/webhook', raw({ type: 'application/json' }));
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
