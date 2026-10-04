import { describe, expect, it } from 'vitest';
import { isWeakExtractedTitle, titleFromUrl } from '../server/linkPreview';

describe('preview title fallbacks', () => {
  it('rejects numeric extracted titles so URL source labels can be used', () => {
    for (const title of [undefined, null, '', '  ', ' 973820 ']) expect(isWeakExtractedTitle(title)).toBe(true);
    expect(isWeakExtractedTitle('Article 973820')).toBe(false);
    expect(titleFromUrl('https://www.ozbargain.com.au/node/973820')).toBe('Ozbargain item 973820');
  });

  it('preserves readable slugs and domain fallbacks', () => {
    expect(titleFromUrl('https://example.com/a-readable_title.html')).toBe('A readable title');
    expect(titleFromUrl('https://example.com/')).toBe('example.com');
  });
});
