import { useCallback, useEffect, useState } from 'react';
import { parseRoute, Route } from '../utils/route';

/** Tracks the current pathname as a Route and keeps it in sync with Back/Forward. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /** `replace` swaps the current entry instead of adding one, e.g. when moving between Settings sections. */
  const navigate = useCallback((path: string, { replace = false }: { replace?: boolean } = {}) => {
    if (path !== window.location.pathname) {
      if (replace) {
        window.history.replaceState(window.history.state, '', path);
      } else {
        // Mark entries pushed by the app so "Back" can return to the previous view.
        window.history.pushState({ fromApp: true }, '', path);
      }
    }
    setRoute(parseRoute(path));
  }, []);

  /** Go back if the previous entry is ours, otherwise replace with the fallback path. */
  const goBack = useCallback((fallbackPath = '/') => {
    if (window.history.state?.fromApp) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', fallbackPath);
      setRoute(parseRoute(fallbackPath));
    }
  }, []);

  return { route, navigate, goBack };
}
