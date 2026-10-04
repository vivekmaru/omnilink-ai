// Minimal client-side routing. The server already sends every non-API path
// to index.html, so the app only has to map the pathname to a view.

export const SETTINGS_SECTIONS = ['ai-models', 'extension', 'mobile', 'export', 'backup', 'tokens'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type Route =
  | { name: 'home' }
  | { name: 'link'; id: string }
  | { name: 'settings'; section: SettingsSection | null };

export const linkPath = (id: string) => `/link/${encodeURIComponent(id)}`;
export const settingsPath = (section?: SettingsSection) => (section ? `/settings/${section}` : '/settings');

export function parseRoute(pathname: string): Route {
  const match = pathname.match(/^\/link\/([^/]+)\/?$/);
  if (match) {
    try {
      return { name: 'link', id: decodeURIComponent(match[1]) };
    } catch {
      return { name: 'home' };
    }
  }
  const settings = pathname.match(/^\/settings(?:\/([^/]+))?\/?$/);
  if (settings) {
    const section = SETTINGS_SECTIONS.find((s) => s === settings[1]) ?? null;
    return { name: 'settings', section };
  }
  return { name: 'home' };
}
