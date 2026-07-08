import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';

export type GlobalMailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  from?: string;
  attachments?: SendMailOptions['attachments'];
};

export type GlobalMailResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: 'SMTP_NOT_CONFIGURED' | 'SMTP_SEND_FAILED';
  messageId?: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;
  private defaultFrom = '';
  private defaultReplyTo = '';
  private warnedNotConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.configureTransport();
  }

  isConfigured() {
    return Boolean(this.transporter && this.defaultFrom);
  }

  async send(payload: GlobalMailPayload): Promise<GlobalMailResult> {
    if (!this.isConfigured()) {
      if (!this.warnedNotConfigured) {
        this.logger.warn(
          'SMTP is not configured. Email delivery is skipped until SMTP_HOST and SMTP_FROM are set. Optional authentication uses SMTP_USER and SMTP_PASS.',
        );
        this.warnedNotConfigured = true;
      }
      return { sent: false, skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
    }

    try {
      const result = await this.transporter!.sendMail({
        from: payload.from || this.defaultFrom,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        replyTo: payload.replyTo || this.defaultReplyTo || undefined,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        attachments: payload.attachments,
      });
      return { sent: true, messageId: String(result.messageId || '') };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP email delivery failed: ${message}`);
      return { sent: false, reason: 'SMTP_SEND_FAILED' };
    }
  }

  private configureTransport() {
    const host = this.configService.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const secure = this.booleanEnv('SMTP_SECURE', port === 465);
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const pass = this.configService.get<string>('SMTP_PASS')?.trim();
    this.defaultFrom = (
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('EMAIL_FROM') ||
      ''
    ).trim();
    this.defaultReplyTo = this.configService.get<string>('SMTP_REPLY_TO')?.trim() || '';

    if (!host || !this.defaultFrom) {
      this.transporter = undefined;
      return;
    }

    if ((user && !pass) || (!user && pass)) {
      this.logger.warn('SMTP authentication is incomplete. Both SMTP_USER and SMTP_PASS are required when authentication is used.');
      this.transporter = undefined;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: Number(this.configService.get<string>('SMTP_CONNECTION_TIMEOUT') || 10000),
      greetingTimeout: Number(this.configService.get<string>('SMTP_GREETING_TIMEOUT') || 10000),
      socketTimeout: Number(this.configService.get<string>('SMTP_SOCKET_TIMEOUT') || 20000),
      tls: {
        rejectUnauthorized: this.booleanEnv('SMTP_TLS_REJECT_UNAUTHORIZED', true),
      },
    });

    this.logger.log(`Global SMTP service configured for ${host}:${Number.isFinite(port) ? port : 587}`);
  }

  private booleanEnv(key: string, fallback: boolean) {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  }
}
