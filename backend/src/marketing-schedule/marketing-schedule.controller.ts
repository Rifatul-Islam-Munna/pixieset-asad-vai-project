import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { MarketingScheduleService } from './marketing-schedule.service';

@Controller('marketing-schedules')
@UseGuards(AuthGuard)
export class MarketingScheduleController {
  constructor(private readonly schedules: MarketingScheduleService) {}

  @Get()
  async list(@Req() req: ExpressRequest) {
    return { data: await this.schedules.list(req.user.id) };
  }

  @Post()
  async create(@Req() req: ExpressRequest, @Body() body: Record<string, unknown>) {
    return { data: await this.schedules.create(req.user.id, body), message: 'Campaign scheduled' };
  }

  @Patch(':id/cancel')
  async cancel(@Req() req: ExpressRequest, @Param('id') id: string) {
    return { data: await this.schedules.cancel(req.user.id, id), message: 'Scheduled campaign cancelled' };
  }
}
