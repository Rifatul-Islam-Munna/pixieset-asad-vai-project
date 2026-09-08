import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('overview')
  async overview(@Req() req: ExpressRequest, @Query('from') from?: string, @Query('to') to?: string) {
    return { data: await this.bookings.overview(req.user.id, from, to) };
  }

  @Patch('settings')
  async settings(@Req() req: ExpressRequest, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.updateSettings(req.user.id, body), message: 'Booking settings saved' };
  }

  @Post('share-links')
  async createShareLink(@Req() req: ExpressRequest, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.createShareLink(req.user.id, body), message: 'Booking link created' };
  }

  @Delete('share-links/:id')
  async deleteShareLink(@Req() req: ExpressRequest, @Param('id') id: string) {
    return { data: await this.bookings.deleteShareLink(req.user.id, id), message: 'Booking link deleted' };
  }

  @Post('services')
  async createService(@Req() req: ExpressRequest, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.createService(req.user.id, body), message: 'Booking type created' };
  }

  @Patch('services/:id')
  async updateService(@Req() req: ExpressRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.updateService(req.user.id, id, body), message: 'Booking type updated' };
  }

  @Delete('services/:id')
  async deleteService(@Req() req: ExpressRequest, @Param('id') id: string) {
    return { data: await this.bookings.deleteService(req.user.id, id), message: 'Booking type deleted' };
  }

  @Post('coworkers')
  async createCoworker(@Req() req: ExpressRequest, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.createCoworker(req.user.id, body), message: 'Co-worker added' };
  }

  @Patch('coworkers/:id')
  async updateCoworker(@Req() req: ExpressRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.updateCoworker(req.user.id, id, body), message: 'Co-worker updated' };
  }

  @Delete('coworkers/:id')
  async deleteCoworker(@Req() req: ExpressRequest, @Param('id') id: string) {
    return { data: await this.bookings.deleteCoworker(req.user.id, id), message: 'Co-worker removed' };
  }

  @Post('events')
  async createEvent(@Req() req: ExpressRequest, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.createEvent(req.user.id, body), message: 'Event created' };
  }

  @Patch('events/:id')
  async updateEvent(@Req() req: ExpressRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.updateEvent(req.user.id, id, body), message: 'Event updated' };
  }

  @Delete('events/:id')
  async deleteEvent(@Req() req: ExpressRequest, @Param('id') id: string) {
    return { data: await this.bookings.deleteEvent(req.user.id, id), message: 'Event deleted' };
  }
}

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get(':identifier')
  async details(@Param('identifier') identifier: string, @Query('invite') invite?: string) {
    return { data: await this.bookings.publicDetails(identifier, invite) };
  }

  @Get(':identifier/availability')
  async availability(
    @Param('identifier') identifier: string,
    @Query('serviceId') serviceId?: string,
    @Query('date') date?: string,
    @Query('invite') invite?: string,
  ) {
    return { data: await this.bookings.publicAvailability(identifier, serviceId, date, invite) };
  }

  @Post(':identifier')
  async create(@Param('identifier') identifier: string, @Body() body: Record<string, unknown>) {
    return { data: await this.bookings.createPublicBooking(identifier, body), message: 'Booking request received' };
  }
}
