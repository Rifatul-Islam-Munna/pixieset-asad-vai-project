import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { AdminService } from './admin.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly adminService: AdminService) {}

  @Get('plans')
  @UseGuards(AuthGuard)
  async plans() {
    const data = await this.adminService.findPlans();
    return { data: data.filter((plan: any) => plan.active) };
  }

  @Get('public/plans')
  async publicPlans() {
    const data = await this.adminService.findPlans();
    return { data: data.filter((plan: any) => plan.active) };
  }

  @Get('capabilities')
  @UseGuards(AuthGuard)
  async capabilities(@Req() req: ExpressRequest) {
    const data = await this.adminService.userCapabilities(req.user.id);
    return { data };
  }

  @Get('purchases')
  @UseGuards(AuthGuard)
  async purchases(@Req() req: ExpressRequest) {
    return { data: await this.adminService.purchaseHistory(req.user.id) };
  }

  @Post('plans/:id/checkout')
  @UseGuards(AuthGuard)
  async checkout(@Param('id') id: string, @Body() dto: any, @Req() req: ExpressRequest) {
    const data = await this.adminService.createPlanCheckout(req.user.id, id, dto.successUrl, dto.cancelUrl);
    return { data };
  }

  @Get('checkout-session/:sessionId')
  @UseGuards(AuthGuard)
  async checkoutSession(@Param('sessionId') sessionId: string, @Req() req: ExpressRequest) {
    const data = await this.adminService.confirmPlanCheckout(sessionId, req.user.id);
    return { data };
  }

  @Post('email-usage')
  @UseGuards(AuthGuard)
  async emailUsage(@Body('count') count: number, @Req() req: ExpressRequest) {
    const data = await this.adminService.addEmailUsage(req.user.id, count);
    return { data };
  }

  @Post('stripe/webhook')
  async stripeWebhook(@Headers('stripe-signature') signature: string | undefined, @Req() req: Request) {
    const data = await this.adminService.handleStripeWebhook(signature, req.body as Buffer);
    return data;
  }
}
