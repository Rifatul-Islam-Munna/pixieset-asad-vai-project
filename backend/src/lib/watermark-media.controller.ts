import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WatermarkRenderService } from './watermark-render.service';

@Controller('public/media')
export class WatermarkMediaController {
  constructor(
    private readonly watermarkRenderService: WatermarkRenderService,
  ) {}

  @Get('watermark/:token')
  async watermark(
    @Param('token') token: string,
    @Res() response: Response,
  ) {
    // Gallery frontend and API use different origins in production. Helmet's
    // default `same-origin` policy blocks this public signed image in <img>.
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    const result = await this.watermarkRenderService.render(token);

    if (result.redirect) {
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.redirect(302, result.redirect);
    }

    if (!result.buffer || !result.contentType) {
      response.status(404).end();
      return;
    }

    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Length', String(result.buffer.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Cache-Control',
      result.cacheable
        ? 'public, max-age=31536000, immutable'
        : 'no-store, max-age=0',
    );
    response.end(result.buffer);
  }
}
