/**
 * CREOVA
 * LazyBoundary
 *
 * Wraps a React.lazy component with:
 *  - a Suspense fallback (loading spinner) while the chunk loads
 *  - the existing diagnostic ErrorBoundary if the chunk fails to load
 *    or the loaded component throws during render
 *
 * Pair with hooks/useLazyComponent, which supplies `LazyComponent` and
 * a `retry` callback.
 */

import { Suspense, type ReactNode } from "react";

import { ErrorBoundary } from "./ErrorBoundary";
import Loading from "../Loading";

interface LazyBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyBoundary({ children, fallback }: LazyBoundaryProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback ?? <Loading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
