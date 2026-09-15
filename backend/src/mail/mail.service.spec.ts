import { buildMimeMessage } from './mail.service';

function decodeBase64Lines(value: string) {
  const base64 = value.replace(/\r?\n/g, '');
  return Buffer.from(base64, 'base64').toString('utf8');
}

describe('mime message building', () => {
  const html = `<div style="background:#f3f2ef"><img src="cid:gallery-logo"><h1>YOUR GALLERY IS WAITING</h1><a href="https://gallery.test">Open Gallery</a></div>`;
  const message = buildMimeMessage({
    from: 'Studio <studio@test.dev>',
    to: ['client@test.dev'],
    cc: [],
    subject: 'Your gallery is waiting',
    text: 'Your gallery is waiting',
    html,
    messageId: '<id@test.dev>',
    attachments: [
      {
        filename: 'gallery-logo',
        content: Buffer.from('fake-png-bytes'),
        contentType: 'image/png',
        contentId: 'gallery-logo',
        disposition: 'inline',
      },
    ],
  });

  it('sends text and html as base64 parts so clients never show raw markup', () => {
    expect(message).toContain('Content-Type: multipart/mixed;');
    expect(message).toContain('Content-Type: multipart/alternative;');
    expect(message).toContain('Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64');
    expect(message).toContain('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64');
    expect(message).not.toContain(html);
  });

  it('keeps the designed html byte-identical after decoding', () => {
    const parts = message.split(/--[\w-]+/);
    const encoded = parts
      .map((part) => part.trim())
      .find((part) => part.startsWith('Content-Type: text/html'));
    expect(encoded).toBeDefined();
    const body = encoded!.split('\r\n\r\n').slice(1).join('\r\n\r\n');
    expect(decodeBase64Lines(body)).toBe(html);
  });

  it('attaches the brand logo inline with a content id the html can reference', () => {
    expect(message).toContain('Content-ID: <gallery-logo>');
    expect(message).toContain('Content-Disposition: inline; filename="gallery-logo"');
    expect(message).toContain('Content-Type: image/png; name="gallery-logo"');
  });
});
