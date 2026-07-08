import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { createConnection, type Socket } from 'node:net';
import { connect as createTlsConnection, type TLSSocket } from 'node:tls';

export type GlobalMailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  from?: string;
};

export type GlobalMailResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: 'SMTP_NOT_CONFIGURED' | 'SMTP_SEND_FAILED';
  messageId?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  requireTls: boolean;
  rejectUnauthorized: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo: string;
  heloName: string;
  timeout: number;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private config?: SmtpConfig;
  private warnedNotConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.config = this.readConfig();
    if (this.config) this.logger.log(`Global SMTP service configured for ${this.config.host}:${this.config.port}`);
  }

  isConfigured() {
    return Boolean(this.config);
  }

  async send(payload: GlobalMailPayload): Promise<GlobalMailResult> {
    if (!this.config) {
      if (!this.warnedNotConfigured) {
        this.logger.warn(
          'SMTP is not configured. Email delivery is skipped until SMTP_HOST and SMTP_FROM are set. Optional authentication uses SMTP_USER and SMTP_PASS.',
        );
        this.warnedNotConfigured = true;
      }
      return { sent: false, skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
    }

    const to = normalizeAddresses(payload.to);
    const cc = normalizeAddresses(payload.cc);
    const bcc = normalizeAddresses(payload.bcc);
    const recipients = [...to, ...cc, ...bcc];
    if (!recipients.length) {
      this.logger.error('SMTP email delivery failed: no recipient address was provided');
      return { sent: false, reason: 'SMTP_SEND_FAILED' };
    }

    const fromHeader = sanitizeHeader(payload.from || this.config.from);
    const fromAddress = extractAddress(fromHeader);
    if (!fromAddress) {
      this.logger.error('SMTP email delivery failed: SMTP_FROM is not a valid email address');
      return { sent: false, reason: 'SMTP_SEND_FAILED' };
    }

    const messageId = `<${randomUUID()}@${fromAddress.split('@')[1] || this.config.heloName}>`;
    const rawMessage = buildMimeMessage({
      from: fromHeader,
      to,
      cc,
      replyTo: payload.replyTo || this.config.replyTo,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      messageId,
    });

    const session = new SmtpSession(this.config);
    try {
      let ehlo = await session.open();
      if (!this.config.secure && this.config.startTls) {
        if (/^250[- ].*STARTTLS/im.test(ehlo)) {
          await session.command('STARTTLS', [220]);
          await session.upgradeToTls();
          ehlo = await session.command(`EHLO ${this.config.heloName}`, [250]);
        } else if (this.config.requireTls) {
          throw new Error('SMTP server does not advertise STARTTLS');
        }
      }

      if (this.config.user && this.config.pass) {
        if (/^250[- ].*AUTH[^\r\n]*\bPLAIN\b/im.test(ehlo)) {
          const token = Buffer.from(`\0${this.config.user}\0${this.config.pass}`).toString('base64');
          await session.command(`AUTH PLAIN ${token}`, [235]);
        } else {
          await session.command('AUTH LOGIN', [334]);
          await session.command(Buffer.from(this.config.user).toString('base64'), [334]);
          await session.command(Buffer.from(this.config.pass).toString('base64'), [235]);
        }
      }

      await session.command(`MAIL FROM:<${fromAddress}>`, [250]);
      for (const recipient of recipients) {
        const address = extractAddress(recipient);
        if (!address) throw new Error(`Invalid recipient address: ${recipient}`);
        await session.command(`RCPT TO:<${address}>`, [250, 251]);
      }
      await session.command('DATA', [354]);
      await session.sendMessage(rawMessage);
      await session.command('QUIT', [221]).catch(() => '');
      session.close();
      return { sent: true, messageId };
    } catch (error) {
      session.close();
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP email delivery failed: ${message}`);
      return { sent: false, reason: 'SMTP_SEND_FAILED' };
    }
  }

  private readConfig(): SmtpConfig | undefined {
    const host = this.configService.get<string>('SMTP_HOST')?.trim() || '';
    const from = (this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('EMAIL_FROM') || '').trim();
    if (!host || !from) return undefined;

    const user = this.configService.get<string>('SMTP_USER')?.trim() || '';
    const pass = this.configService.get<string>('SMTP_PASS')?.trim() || '';
    if ((user && !pass) || (!user && pass)) {
      this.logger.warn('SMTP authentication is incomplete. Both SMTP_USER and SMTP_PASS are required when authentication is used.');
      return undefined;
    }

    const rawPort = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const port = Number.isFinite(rawPort) ? rawPort : 587;
    const secure = this.booleanEnv('SMTP_SECURE', port === 465);
    return {
      host,
      port,
      secure,
      startTls: this.booleanEnv('SMTP_STARTTLS', !secure),
      requireTls: this.booleanEnv('SMTP_REQUIRE_TLS', false),
      rejectUnauthorized: this.booleanEnv('SMTP_TLS_REJECT_UNAUTHORIZED', true),
      user,
      pass,
      from,
      replyTo: this.configService.get<string>('SMTP_REPLY_TO')?.trim() || '',
      heloName: this.configService.get<string>('SMTP_HELO_NAME')?.trim() || hostname() || 'localhost',
      timeout: Number(this.configService.get<string>('SMTP_TIMEOUT') || 20000),
    };
  }

  private booleanEnv(key: string, fallback: boolean) {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  }
}

class SmtpSession {
  private socket?: Socket | TLSSocket;
  private buffer = '';
  private pending?: {
    expected: number[];
    resolve: (response: string) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  };

  constructor(private readonly config: SmtpConfig) {}

  async open() {
    const socket = this.config.secure
      ? createTlsConnection({
          host: this.config.host,
          port: this.config.port,
          servername: this.config.host,
          rejectUnauthorized: this.config.rejectUnauthorized,
        })
      : createConnection({ host: this.config.host, port: this.config.port });

    this.attach(socket);
    await new Promise<void>((resolve, reject) => {
      const event = this.config.secure ? 'secureConnect' : 'connect';
      const timer = setTimeout(() => reject(new Error('SMTP connection timed out')), this.config.timeout);
      socket.once(event, () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    await this.waitForResponse([220]);
    return this.command(`EHLO ${this.config.heloName}`, [250]);
  }

  async upgradeToTls() {
    if (!this.socket || this.socket instanceof (createTlsConnection({} as never).constructor as never)) return;
    const previous = this.socket as Socket;
    previous.removeAllListeners('data');
    const tlsSocket = createTlsConnection({
      socket: previous,
      servername: this.config.host,
      rejectUnauthorized: this.config.rejectUnauthorized,
    });
    this.buffer = '';
    this.attach(tlsSocket);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SMTP STARTTLS timed out')), this.config.timeout);
      tlsSocket.once('secureConnect', () => {
        clearTimeout(timer);
        resolve();
      });
      tlsSocket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  command(command: string, expected: number[]) {
    if (!this.socket) return Promise.reject(new Error('SMTP socket is not connected'));
    const response = this.waitForResponse(expected);
    this.socket.write(`${command}\r\n`);
    return response;
  }

  sendMessage(message: string) {
    if (!this.socket) return Promise.reject(new Error('SMTP socket is not connected'));
    const response = this.waitForResponse([250]);
    const normalized = message.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    this.socket.write(`${normalized.replace(/\r\n$/, '')}\r\n.\r\n`);
    return response;
  }

  close() {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('SMTP connection closed'));
      this.pending = undefined;
    }
    this.socket?.end();
    this.socket?.destroy();
    this.socket = undefined;
  }

  private attach(socket: Socket | TLSSocket) {
    this.socket = socket;
    socket.setTimeout(this.config.timeout, () => {
      this.pending?.reject(new Error('SMTP socket timed out'));
      this.close();
    });
    socket.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      this.processBuffer();
    });
    socket.on('error', (error) => {
      if (this.pending) {
        clearTimeout(this.pending.timer);
        this.pending.reject(error);
        this.pending = undefined;
      }
    });
  }

  private waitForResponse(expected: number[]) {
    if (this.pending) return Promise.reject(new Error('SMTP command overlap detected'));
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = undefined;
        reject(new Error('SMTP response timed out'));
      }, this.config.timeout);
      this.pending = { expected, resolve, reject, timer };
      this.processBuffer();
    });
  }

  private processBuffer() {
    if (!this.pending) return;
    const lines = this.buffer.split('\r\n');
    let endIndex = -1;
    let code = 0;
    for (let index = 0; index < lines.length - 1; index += 1) {
      const match = lines[index].match(/^(\d{3}) /);
      if (match) {
        endIndex = index;
        code = Number(match[1]);
        break;
      }
    }
    if (endIndex < 0) return;

    const response = lines.slice(0, endIndex + 1).join('\r\n');
    this.buffer = lines.slice(endIndex + 1).join('\r\n');
    const pending = this.pending;
    this.pending = undefined;
    clearTimeout(pending.timer);
    if (pending.expected.includes(code)) pending.resolve(response);
    else pending.reject(new Error(`SMTP command failed with ${code}: ${response}`));
  }
}

function normalizeAddresses(value?: string | string[]) {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry) => String(entry).split(',')).map((entry) => sanitizeHeader(entry.trim())).filter(Boolean);
}

function extractAddress(value: string) {
  const bracket = value.match(/<([^<>\s@]+@[^<>\s@]+)>/);
  if (bracket) return bracket[1];
  const plain = value.match(/^[^\s@<>]+@[^\s@<>]+$/);
  return plain ? plain[0] : '';
}

function sanitizeHeader(value: string) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function encodeHeader(value: string) {
  const safe = sanitizeHeader(value);
  return /^[\x20-\x7E]*$/.test(safe) ? safe : `=?UTF-8?B?${Buffer.from(safe).toString('base64')}?=`;
}

function buildMimeMessage(input: {
  from: string;
  to: string[];
  cc: string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  messageId: string;
}) {
  const boundary = `mobile-gallery-${randomUUID()}`;
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(', ')}`,
    ...(input.cc.length ? [`Cc: ${input.cc.join(', ')}`] : []),
    ...(input.replyTo ? [`Reply-To: ${sanitizeHeader(input.replyTo)}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${input.messageId}`,
    'MIME-Version: 1.0',
  ];

  if (input.text && input.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return `${headers.join('\r\n')}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(input.text)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(input.html)}\r\n--${boundary}--\r\n`;
  }

  const isHtml = Boolean(input.html);
  headers.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=UTF-8`);
  headers.push('Content-Transfer-Encoding: base64');
  return `${headers.join('\r\n')}\r\n\r\n${base64Lines(input.html || input.text || '')}\r\n`;
}

function base64Lines(value: string) {
  return Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
}
