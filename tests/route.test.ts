import { describe, expect, it } from 'vitest';
import { linkPath, parseRoute, settingsPath } from '../src/utils/route';

describe('parseRoute', () => {
  it('treats the root and unknown paths as home', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/settingsx')).toEqual({ name: 'home' });
    expect(parseRoute('/link/')).toEqual({ name: 'home' });
  });

  it('reads a link id, with or without a trailing slash', () => {
    expect(parseRoute('/link/abc123')).toEqual({ name: 'link', id: 'abc123' });
    expect(parseRoute('/link/abc123/')).toEqual({ name: 'link', id: 'abc123' });
  });

  it('round-trips ids that need encoding', () => {
    const id = 'a b/c?d';
    expect(parseRoute(linkPath(id))).toEqual({ name: 'link', id });
  });

  it('falls back to home on malformed encoding', () => {
    expect(parseRoute('/link/%E0%A4%A')).toEqual({ name: 'home' });
  });

  it('reads the settings section, ignoring unknown ones', () => {
    expect(parseRoute('/settings')).toEqual({ name: 'settings', section: null });
    expect(parseRoute(settingsPath('backup'))).toEqual({ name: 'settings', section: 'backup' });
    expect(parseRoute('/settings/tokens/')).toEqual({ name: 'settings', section: 'tokens' });
    expect(parseRoute('/settings/whatever')).toEqual({ name: 'settings', section: null });
  });
});
