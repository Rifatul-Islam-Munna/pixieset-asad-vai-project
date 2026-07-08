import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from 'src/lib/auth.guard';
import { MailService } from './mail.service';

@Controller('mail')
@UseGuards(AuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  async send(@Req() req: ExpressRequest, @Body() body: Record<string, any>) {
    const to = this.emailList(body.to);
    const cc = this.emailList(body.cc);
    const bcc = this.emailList(body.bcc);
    const replyTo = this.email(body.replyTo);
    const subject = this.text(body.subject, 180);
    const text = this.text(body.text, 8000);
    const html = this.text(body.html, 20000);

    if (!to.length) throw new BadRequestException('A valid recipient email is required');
    if (!subject) throw new BadRequestException('Email subject is required');
    if (!text && !html) throw new BadRequestException('Email body is required');

    const result = await this.mailService.send({
      to,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
      html,
    });

    return { data: { ...result, userId: req.user.id } };
  }

  private emailList(value: unknown) {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    return items.map((item) => this.email(item)).filter((item): item is string => Boolean(item));
  }

  private email(value: unknown) {
    const text = String(value ?? '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : '';
  }

  private text(value: unknown, max: number) {
    return String(value ?? '').trim().slice(0, max);
  }
}
