/**
 * CREOVA
 * Generic TTL cache backed by AsyncStorage.
 *
 * Used to avoid repeating paid cloud AI calls for identical or recent
 * requests, and to keep data available while offline. Not a replacement
 * for the database — this is a best-effort, device-local cache only.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "creova:cache:";
const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function keyFor(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/**
 * Deterministic, dependency-free hash for building cache keys out of
 * arbitrary strings (e.g. a prompt). Not cryptographic — collisions are
 * acceptable here since a wrong cache hit only costs a re-fetch.
 */
export function hashString(input: string): string {
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(key));

    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as CacheEntry<T>;

    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(keyFor(key));
      return null;
    }

    return entry.value;
  } catch {
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  try {
    await AsyncStorage.setItem(keyFor(key), JSON.stringify(entry));
  } catch {
    // Cache writes are best-effort; a failure here should never break the caller.
  }
}

/**
 * Returns the cached value if present and fresh, otherwise calls `fetcher`,
 * caches the result, and returns it. Use this to wrap any expensive or
 * paid call (cloud AI, remote config, etc.).
 */
export async function getOrSetCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = await getCached<T>(key);

  if (cached !== null) {
    return cached;
  }

  const value = await fetcher();
  await setCached(key, value, ttlMs);
  return value;
}

export async function clearCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(key));
}

export async function clearAllCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));

  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}
