import { Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, type ExpressRequest } from '../lib/auth.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { StudioCalendarService } from './studio-calendar.service';

@Controller('studio/calendar-sync')
@UseGuards(AuthGuard)
export class StudioCalendarController {
  constructor(private readonly service: StudioCalendarService) {}

  @Get()
  get(@Req() req: ExpressRequest) {
    return this.service.getOrCreate(req.user.id).then((data) => ({ data }));
  }

  @Post('rotate')
  rotate(@Req() req: ExpressRequest) {
    return this.service.rotate(req.user.id).then((data) => ({ data }));
  }

  @Post('enable')
  enable(@Req() req: ExpressRequest) {
    return this.service.enable(req.user.id).then((data) => ({ data }));
  }

  @Delete()
  revoke(@Req() req: ExpressRequest) {
    return this.service.revoke(req.user.id).then((data) => ({ data }));
  }
}

@Controller('public/studio/calendar')
@UseGuards(ThrottlerGuard)
export class StudioPublicCalendarController {
  constructor(private readonly service: StudioCalendarService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async get(@Param('token') token: string, @Res({ passthrough: true }) response: Response) {
    const ics = await this.service.render(token);
    response.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'Content-Disposition': 'inline; filename="studio-calendar.ics"',
    });
    return ics;
  }
}
