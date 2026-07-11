import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, raw, static as serveStatic, urlencoded } from 'express';
import { join } from 'path';
import { cwd } from 'process';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

function allowedOrigin(origin?: string) {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'gallerista.app' || host.endsWith('.gallerista.app')) return true;
    const configured = [process.env.FRONTEND_URL, process.env.ROOT_DOMAIN]
      .filter(Boolean)
      .map((value) => new URL(String(value).includes('://') ? String(value) : `https://${value}`).hostname.toLowerCase());
    return configured.some((item) => host === item || host.endsWith(`.${item}`));
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  app.use(compression());
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cookieParser());
  app.enableCors({
    origin: (origin, callback) => callback(null, allowedOrigin(origin) ? origin || true : false),
    credentials: true,
  });
  app.use('/uploads', serveStatic(join(cwd(), 'uploads')));
  app.use('/billing/stripe/webhook', raw({ type: 'application/json' }));
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
