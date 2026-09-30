/**
 * Reading from the server without a caching library: load when a screen opens, again when it
 * comes back into view or the app returns to the foreground, and keep the last good answer
 * on screen when a refresh fails (offline, say), with the error alongside.
 */

import { useNetworkState } from 'expo-network';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError } from './api';

export interface Remote<T> {
  data: T | null;
  error: ApiError | null;
  /** First load, nothing to show yet. */
  loading: boolean;
  /** A refresh the person asked for (pull to refresh). */
  refreshing: boolean;
  reload: (opts?: { quiet?: boolean }) => void;
}

function asApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(500, undefined, String(err));
}

/**
 * `load` runs whenever `key` changes (null: don't load). Answers to superseded requests are
 * dropped, so a slow old response never replaces a newer one.
 */
export function useRemote<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): Remote<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(key !== null);
  const [refreshing, setRefreshing] = useState(false);
  const current = useRef<AbortController | null>(null);
  const lastRun = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  const run = useCallback(
    (quiet: boolean) => {
      if (key === null) return;
      lastRun.current = Date.now();
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      if (!quiet) setRefreshing(true);
      loader
        .current(controller.signal)
        .then((value) => {
          if (controller.signal.aborted) return;
          setData(value);
          setError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setError(asApiError(err));
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [key],
  );

  useEffect(() => {
    if (key === null) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    run(true);
    return () => current.current?.abort();
  }, [key, run]);

  // Fresh again when the screen comes back into view or the app returns to the foreground,
  // unless it was loaded a moment ago.
  const refreshIfStale = useCallback(() => {
    if (Date.now() - lastRun.current > 15_000) run(true);
  }, [run]);
  useFocusEffect(refreshIfStale);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfStale();
    });
    return () => sub.remove();
  }, [refreshIfStale]);

  const reload = useCallback((opts?: { quiet?: boolean }) => run(Boolean(opts?.quiet)), [run]);
  return { data, error, loading, refreshing, reload };
}

/** False only when the phone knows it has no connection (unknown counts as online). */
export function useOnline(): boolean {
  const state = useNetworkState();
  return state.isInternetReachable !== false && state.isConnected !== false;
}
