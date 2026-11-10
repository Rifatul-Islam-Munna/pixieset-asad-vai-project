import { ConfigService } from '@nestjs/config';
import { createServer, type Socket } from 'node:net';
import { MailService } from './mail.service';
import { BrandingEmailService } from './branding-email.service';

async function smtpFixture(rejectMail = false) {
  let message = '';
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '', dataMode = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      while (buffer) {
        if (dataMode) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end < 0) return;
          message = buffer.slice(0, end); buffer = buffer.slice(end + 5); dataMode = false;
          socket.write('250 message accepted\r\n'); continue;
        }
        const end = buffer.indexOf('\r\n'); if (end < 0) return;
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (line.startsWith('EHLO')) socket.write('250 localhost\r\n');
        else if (line.startsWith('MAIL FROM')) socket.write(rejectMail ? '550 sender rejected\r\n' : '250 sender accepted\r\n');
        else if (line.startsWith('RCPT TO')) socket.write('250 recipient accepted\r\n');
        else if (line === 'DATA') { dataMode = true; socket.write('354 send message\r\n'); }
        else if (line === 'QUIT') socket.end('221 goodbye\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const config = new ConfigService({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false',
    SMTP_STARTTLS: 'false', SMTP_FROM: 'studio@test.dev', SMTP_TIMEOUT: '1000' });
  const mail = new MailService(config); mail.onModuleInit();
  const brandModel = { findOne: () => ({ lean: async () => ({ data: { brandText: 'Test Studio' } }) }) };
  const branding = new BrandingEmailService(brandModel as any, mail, config);
  return { mail, branding, message: () => message, close: async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } };
}

describe('download email over SMTP', () => {
  it('delivers the exact download URL in both email text and clickable branded button', async () => {
    const smtp = await smtpFixture();
    const link = `https://api.test/public/collections/download-deliveries/${'a'.repeat(64)}`;
    try {
      const result = await smtp.branding.sendBranded({ userId: 'owner', to: 'client@test.dev', subject: 'Photos ready',
        title: 'Your photos are ready', message: 'Download all photos in one folder.',
        buttonText: 'Download all photos', buttonLink: link, text: `Download: ${link}` });
      expect(result.sent).toBe(true);
      for (const contentType of ['text/plain', 'text/html']) {
        const part = smtp.message().split(/--[\w-]+/).map((part) => part.trim())
          .find((part) => part.startsWith(`Content-Type: ${contentType}`));
        expect(part).toBeDefined();
        const decoded = Buffer.from(part!.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\s/g, ''), 'base64').toString();
        expect(decoded).toContain(link);
        if (contentType === 'text/html') expect(decoded).toContain(`href="${link}"`);
      }
    } finally { await smtp.close(); }
  });

  it('reports SMTP rejection as failure instead of claiming the email was sent', async () => {
    const smtp = await smtpFixture(true);
    try {
      const result = await smtp.mail.send({ to: 'client@test.dev', subject: 'Photos', text: 'Download link' });
      expect(result.sent).toBe(false); expect(result.reason).toBe('SMTP_SEND_FAILED');
    } finally { await smtp.close(); }
  });
});
