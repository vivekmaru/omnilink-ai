// Minimal client-side routing. The server already sends every non-API path
// to index.html, so the app only has to map the pathname to a view.

export type Route = { name: 'home' } | { name: 'link'; id: string };

export const linkPath = (id: string) => `/link/${encodeURIComponent(id)}`;

export function parseRoute(pathname: string): Route {
  const match = pathname.match(/^\/link\/([^/]+)\/?$/);
  if (match) {
    try {
      return { name: 'link', id: decodeURIComponent(match[1]) };
    } catch {
      return { name: 'home' };
    }
  }
  return { name: 'home' };
}
