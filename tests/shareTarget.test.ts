import { describe, it, expect } from 'vitest';
import { parseShareTargetParams } from '../src/utils/url';

describe('PWA Mobile Web Share Target & Query Parser Suite', () => {
  it('parses standard ?url= and ?title= parameters', () => {
    const search = '?url=https%3A%2F%2Fgithub.com%2Fastral-sh%2Fuv&title=Fast+Python+Manager';
    const parsed = parseShareTargetParams(search);
    expect(parsed.url).toBe('https://github.com/astral-sh/uv');
    expect(parsed.title).toBe('Fast Python Manager');
  });

  it('extracts URL when mobile OS sends link inside text parameter', () => {
    const search = '?text=Check+out+this+video+https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D123456+it+is+great&title=Great+Tutorial';
    const parsed = parseShareTargetParams(search);
    expect(parsed.url).toBe('https://www.youtube.com/watch?v=123456');
    expect(parsed.title).toBe('Great Tutorial');
    expect(parsed.notes).toContain('Check out this video');
    expect(parsed.notes).toContain('it is great');
  });

  it('handles raw URL passed inside title when url is empty', () => {
    const search = '?title=https%3A%2F%2Finstagram.com%2Freel%2FC8k9xL2pQ1M%2F&text=Cool+design';
    const parsed = parseShareTargetParams(search);
    expect(parsed.url).toBe('https://instagram.com/reel/C8k9xL2pQ1M/');
    expect(parsed.notes).toBe('Cool design');
  });

  it('returns empty object when query string is empty', () => {
    expect(parseShareTargetParams('')).toEqual({});
  });
});
