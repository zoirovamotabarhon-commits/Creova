/**
 * CREOVA
 * useLazyComponent
 *
 * Wraps React.lazy for a single dynamic import, with a manual retry
 * (mobile bundles are sometimes fetched over flaky connections, and a
 * failed chunk load shouldn't be permanent). Pair with LazyBoundary,
 * which supplies the Suspense fallback and catches load errors.
 */

import { lazy, useMemo, useState, type ComponentType } from "react";

type Importer<P> = () => Promise<{ default: ComponentType<P> }>;

export function useLazyComponent<P>(importer: Importer<P>) {
  const [attempt, setAttempt] = useState(0);

  const LazyComponent = useMemo(() => {
    return lazy(importer);
    // Re-running the importer requires a fresh lazy() call, hence the
    // `attempt` dependency even though it isn't read directly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = () => setAttempt((current) => current + 1);

  return { LazyComponent, retry };
}
