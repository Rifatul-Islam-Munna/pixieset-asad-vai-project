import {Body, Controller, Get, Patch, Post, Param, Req, UseGuards} from '@nestjs/common';
import {Throttle, ThrottlerGuard} from '@nestjs/throttler';
import {AuthGuard, type ExpressRequest} from '../lib/auth.guard';
import {StudioPaymentsService} from './studio-payments.service';

@Controller('studio/payments')
@UseGuards(AuthGuard,ThrottlerGuard)
export class StudioPaymentsController {
  constructor(private readonly payments:StudioPaymentsService) {}

  @Get('settings')
  settings(@Req() request:ExpressRequest) {
    return this.payments.settings(request.user.id).then(data=>({data}));
  }

  @Patch('settings')
  @Throttle({default:{limit:8,ttl:60000}})
  update(@Req() request:ExpressRequest,@Body() body:Record<string,unknown>) {
    return this.payments.updateSettings(request.user.id,body).then(data=>({data}));
  }

  @Post('paypal/test')
  @Throttle({default:{limit:4,ttl:60000}})
  testPayPal(@Req() request:ExpressRequest) {
    return this.payments.testPayPal(request.user.id).then(data=>({data}));
  }
}

@Controller('public/studio/invoices')
@UseGuards(ThrottlerGuard)
export class PublicStudioPaymentsController {
  constructor(private readonly payments:StudioPaymentsService) {}

  @Get(':token/methods')
  methods(@Param('token') token:string) {
    return this.payments.methods(token).then(data=>({data}));
  }

  @Post(':token/checkout')
  @Throttle({default:{limit:5,ttl:60000}})
  checkout(@Param('token') token:string,@Body('provider') provider:'stripe'|'paypal') {
    return this.payments.startCheckout(token,provider).then(data=>({data}));
  }

  @Post(':token/verify')
  @Throttle({default:{limit:8,ttl:60000}})
  verify(@Param('token') token:string,@Body() body:{provider:'stripe'|'paypal';referenceId:string}) {
    return this.payments.verifyPayment(token,body.provider,body.referenceId).then(data=>({data}));
  }
}
