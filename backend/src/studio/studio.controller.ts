import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { StudioService } from './studio.service';

@Controller('studio')
@UseGuards(AuthGuard)
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get('overview')
  overview(@Req() req: ExpressRequest) {
    return this.studio.overview(req.user.id).then((data) => ({ data }));
  }

  @Get('projects/payments')
  projectPayments(@Req() req: ExpressRequest) {
    return this.studio.projectPayments(req.user.id).then((data) => ({ data }));
  }

  @Get('reports/summary')
  reports(@Req() req: ExpressRequest) {
    return this.studio.financialReport(req.user.id).then((data) => ({ data }));
  }

  @Post('messages/send')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  sendEmail(@Req() req: ExpressRequest, @Body() body: Record<string, unknown>) {
    return this.studio.sendEmail(req.user.id, body).then((data) => ({ data }));
  }

  @Post('invoices/:id/send')
  sendInvoice(@Req() req: ExpressRequest, @Param('id') id: string) {
    return this.studio.sendInvoice(req.user.id, id).then((data) => ({ data }));
  }

  @Post('templates/:id/use')
  useTemplate(@Req() req: ExpressRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.studio.useTemplate(req.user.id, id, body).then((data) => ({ data }));
  }

  @Post('documents/:id/send')
  sendDocument(@Req() req: ExpressRequest, @Param('id') id: string) {
    return this.studio.sendContract(req.user.id, id).then((data) => ({ data }));
  }

  @Get(':kind/:id/share-url')
  shareUrl(@Req() req:ExpressRequest,@Param('kind') kind:string,@Param('id') id:string){
    return this.studio.shareUrl(req.user.id,kind,id).then(data=>({data}));
  }

  @Post('invoices/:id/record-payment')
  recordPayment(@Req() req: ExpressRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.studio.recordPayment(req.user.id, id, body).then((data) => ({ data }));
  }

  @Get(':kind')
  list(@Req() req: ExpressRequest, @Param('kind') kind: string,
    @Query() query: Record<string, unknown>) {
    return this.studio.list(req.user.id, kind, query).then((data) => ({ data }));
  }

  @Get(':kind/:id')
  detail(@Req() req: ExpressRequest, @Param('kind') kind: string, @Param('id') id: string) {
    return this.studio.get(req.user.id, kind, id).then((data) => ({ data }));
  }

  @Post(':kind')
  create(@Req() req: ExpressRequest, @Param('kind') kind: string, @Body() body: Record<string, unknown>) {
    return this.studio.create(req.user.id, kind, body).then((data) => ({ data }));
  }

  @Patch(':kind/:id')
  update(@Req() req: ExpressRequest, @Param('kind') kind: string, @Param('id') id: string,
    @Body() body: Record<string, unknown>) {
    return this.studio.update(req.user.id, kind, id, body).then((data) => ({ data }));
  }

  @Delete(':kind/:id')
  remove(@Req() req: ExpressRequest, @Param('kind') kind: string, @Param('id') id: string) {
    return this.studio.remove(req.user.id, kind, id).then((data) => ({ data }));
  }
}

@Controller('public/studio')
@UseGuards(ThrottlerGuard)
export class PublicStudioController {
  constructor(private readonly studio: StudioService) {}

  @Get('forms/:token')
  getForm(@Param('token') token: string) {
    return this.studio.publicForm(token).then((data) => ({ data }));
  }

  @Post('forms/:token/submit')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submitForm(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.studio.submitForm(token, body).then((data) => ({ data }));
  }

  @Get('invoices/:token')
  invoice(@Param('token') token: string) {
    return this.studio.publicInvoice(token).then((data) => ({ data }));
  }

  @Get('payment-links/:token')
  paymentRequest(@Param('token') token: string) {
    return this.studio.publicPaymentLink(token).then((data) => ({ data }));
  }

  @Get('contracts/:token')
  contract(@Param('token') token: string) {
    return this.studio.publicContract(token).then((data) => ({ data }));
  }

  @Get('questionnaires/:token')
  questionnaire(@Param('token') token: string) {
    return this.studio.publicOtherDocument(token, 'questionnaire').then((data) => ({ data }));
  }

  @Post('questionnaires/:token/submit')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submitQuestionnaire(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.studio.submitQuestionnaire(token, body).then((data) => ({ data }));
  }

  @Get('quotes/:token')
  quote(@Param('token') token: string) {
    return this.studio.publicOtherDocument(token, 'quote').then((data) => ({ data }));
  }

  @Post('quotes/:token/accept')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  acceptQuote(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.studio.acceptQuote(token, body).then((data) => ({ data }));
  }

  @Post('contracts/:token/sign')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  sign(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.studio.signContract(token, body).then((data) => ({ data }));
  }
}
