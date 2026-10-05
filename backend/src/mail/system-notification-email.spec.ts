import {
  buildSystemNotificationEmail,
  describeUserAgent,
  formatNotificationTime,
} from './system-notification-email';

describe('system notification email', () => {
  it('renders Pixieset-style account activity details safely', () => {
    const result = buildSystemNotificationEmail({
      brand: 'Gallerista',
      logoUrl: 'https://cdn.example.com/gallerista-logo.png',
      subject: 'New login to Gallerista',
      heading: 'New login to Gallerista',
      intro: 'We noticed a new login with your Gallerista account',
      accountEmail: 'owner@example.com',
      details: [
        { label: 'Device', value: 'Windows, Chrome 154' },
        { label: 'New IP', value: '203.0.113.7' },
      ],
      warning:
        'If you do not recognize this login, change your password immediately.',
    });

    expect(result.subject).toBe('New login to Gallerista');
    expect(result.html).toContain('alt="Gallerista"');
    expect(result.html).toContain('owner@example.com');
    expect(result.html).toContain('https://cdn.example.com/gallerista-logo.png');
    expect(result.html).toContain('<img');
    expect(result.html).toContain('203.0.113.7');
    expect(result.html).not.toContain('<script>');
  });

  it('describes common browsers and emits UTC timestamps', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
      ),
    ).toBe('Windows, Chrome 154');
    expect(formatNotificationTime(new Date('2026-10-05T10:58:00Z'))).toContain(
      '(UTC)',
    );
  });
});
