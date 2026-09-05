/**
 * CREOVA
 * useOfflineSync
 *
 * Queues actions (e.g. a chat message that couldn't reach the cloud model)
 * in AsyncStorage while the device is offline, and flushes them
 * automatically once NetInfo reports connectivity again. Keeps the app
 * useful with no connection instead of just showing an error.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const QUEUE_STORAGE_KEY = "creova:offline-sync:queue";

export interface QueuedAction<T = unknown> {
  id: string;
  createdAt: number;
  payload: T;
}

async function readQueue<T>(): Promise<QueuedAction<T>[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction<T>[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue<T>(queue: QueuedAction<T>[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Best-effort persistence — losing the queue is safer than crashing.
  }
}

/**
 * `processAction` should perform the real work (e.g. call the cloud AI
 * client) and resolve on success or reject on failure. Failed items stay
 * in the queue and are retried on the next reconnect.
 */
export function useOfflineSync<T>(processAction: (payload: T) => Promise<void>) {
  const [queue, setQueue] = useState<QueuedAction<T>[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const processActionRef = useRef(processAction);
  processActionRef.current = processAction;

  useEffect(() => {
    readQueue<T>().then(setQueue);
  }, []);

  const flush = useCallback(async () => {
    setIsSyncing((currentlySyncing) => {
      if (currentlySyncing) {
        return currentlySyncing;
      }
      return true;
    });

    const pending = await readQueue<T>();
    const remaining: QueuedAction<T>[] = [];

    for (const item of pending) {
      try {
        await processActionRef.current(item.payload);
      } catch {
        remaining.push(item);
      }
    }

    await writeQueue(remaining);
    setQueue(remaining);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flush();
      }
    });

    return () => unsubscribe();
  }, [flush]);

  const enqueue = useCallback(async (payload: T) => {
    const item: QueuedAction<T> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      payload,
    };

    const current = await readQueue<T>();
    const next = [...current, item];

    await writeQueue(next);
    setQueue(next);
  }, []);

  return {
    queue,
    isSyncing,
    enqueue,
    flush,
  };
}
