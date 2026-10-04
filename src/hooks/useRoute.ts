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

  const navigate = useCallback((path: string) => {
    if (path !== window.location.pathname) {
      // Mark entries pushed by the app so "Back" can return to the previous view.
      window.history.pushState({ fromApp: true }, '', path);
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
