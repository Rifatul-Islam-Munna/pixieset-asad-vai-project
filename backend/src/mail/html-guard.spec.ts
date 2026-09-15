import { hasInlineDataUri, sanitizeEmailHtml } from './html-guard';

const dataLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAtwAAALcAAAAA';

describe('email html guard', () => {
  it('strips a base64 data: image source that clients cannot render', () => {
    const html = `<table><tr><td><img src="${dataLogo}" alt="brand" style="max-width:180px"></td></tr></table>`;
    const clean = sanitizeEmailHtml(html);
    expect(clean).not.toContain('data:image/png');
    expect(clean).toContain('<img src="" alt="brand"');
    expect(hasInlineDataUri(clean)).toBe(false);
  });

  it('strips unquoted sources and css url(data:) values', () => {
    const html = `<img src=${dataLogo}><div style="background:url(${dataLogo})"></div>`;
    const clean = sanitizeEmailHtml(html);
    expect(clean).not.toContain('data:image');
    expect(clean).toContain('<img src="">');
    expect(clean).toContain('url()');
  });

  it('keeps cid: and https: sources so the designed email stays intact', () => {
    const html = `<img src="cid:gallery-logo"><img src="https://cdn.test/cover.jpg">`;
    expect(sanitizeEmailHtml(html)).toBe(html);
    expect(hasInlineDataUri(html)).toBe(false);
  });

  it('detects remaining data uris', () => {
    expect(hasInlineDataUri(`<img src="${dataLogo}">`)).toBe(true);
    expect(hasInlineDataUri('<img src="cid:gallery-logo">')).toBe(false);
  });
});
