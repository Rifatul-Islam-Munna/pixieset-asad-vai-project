import { applyStudioCoverTitle, needsStudioCoverTitle } from './collection-cover-small-title';

describe('collection cover studio title', () => {
  it('replaces empty and legacy preset defaults with the studio name', () => {
    expect(applyStudioCoverTitle(undefined, 'My Photo Studio').coverSmallTitle).toBe('My Photo Studio');
    expect(applyStudioCoverTitle({ coverSmallTitle: 'Avery Studio' }, 'My Photo Studio').coverSmallTitle).toBe('My Photo Studio');
    expect(applyStudioCoverTitle({ coverSmallTitle: 'Your Studio' }, 'My Photo Studio').coverSmallTitle).toBe('My Photo Studio');
  });

  it('preserves deliberate custom cover text and unrelated design settings', () => {
    const design = { coverSmallTitle: 'Our story', coverTitle: 'Mira & Leo', showCoverSmallTitle: false };
    expect(needsStudioCoverTitle(design.coverSmallTitle)).toBe(false);
    expect(applyStudioCoverTitle(design, 'Studio X')).toEqual(design);
  });

  it('uses a safe fallback without branding', () => {
    expect(applyStudioCoverTitle({}, '').coverSmallTitle).toBe('Your Studio');
  });
});
