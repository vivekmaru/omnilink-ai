export function isWeakExtractedTitle(title: unknown): boolean {
  return typeof title !== 'string' || !title.trim() || /^\d+$/.test(title.trim());
}

export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    if (pathSegments.length === 0) return parsed.hostname;
    let title = pathSegments[pathSegments.length - 1]
      .replace(/[-_]/g, ' ')
      .replace(/\.(html|php|asp|aspx)$/i, '');
    if (/^\d+$/.test(title.trim())) {
      const sourceName = parsed.hostname.replace(/^www\./i, '').split('.')[0];
      title = `${sourceName} item ${title.trim()}`;
    }
    return title.charAt(0).toUpperCase() + title.slice(1);
  } catch {
    return url;
  }
}
