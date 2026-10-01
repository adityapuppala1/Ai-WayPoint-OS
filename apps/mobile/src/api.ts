/**
 * The Waypoint API, from the app. Same endpoints as the website (`/api/…`, documented at
 * `/api/openapi.json`). On phones the session cookie comes from the secure keystore (see
 * auth.ts) and is sent by hand, because native requests have no cookie jar; on the web build
 * the browser sends it.
 *
 * Errors arrive as problem details ({ type, title, status, code, detail }) and become ApiError.
 * No network, or no answer within the time limit, is ApiError with status 0.
 */
import { Platform } from 'react-native';
import { authClient } from './auth';
import { API_URL } from './config';

let locale = 'en';

/** The language answers should come back in (set by the i18n provider). */
export function setApiLocale(next: string): void {
  locale = next;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
    /** Seconds to wait before trying again, when the server said so. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The request never reached Waypoint: offline, or the connection dropped. */
  get offline(): boolean {
    return this.status === 0;
  }
}

/** Headers for any request to Waypoint: the app's language and, on phones, the session. */
export async function apiHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'accept-language': locale,
    ...extra,
  };
  if (Platform.OS !== 'web') {
    // The session's cookie, and any the request carries of its own (Today's "not now").
    const cookie = [await authClient.getCookie(), extra.cookie].filter(Boolean).join('; ');
    if (cookie) headers.cookie = cookie;
  }
  return headers;
}

/** Native requests keep no cookies of their own; the browser build sends the site's cookie. */
export const credentials: RequestCredentials = Platform.OS === 'web' ? 'include' : 'omit';

export interface ApiInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON. A request with a body defaults to POST. */
  json?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Give up after this long (default 20 s). */
  timeoutMs?: number;
}

/** A signal that fires when the caller's does, or when time runs out. */
function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const method = init.method ?? (init.json === undefined ? 'GET' : 'POST');
  // Every write says it is JSON: the server refuses form-like posts from other sites.
  const headers = await apiHeaders(
    method === 'GET' ? init.headers : { 'content-type': 'application/json', ...init.headers },
  );
  const timeout = withTimeout(init.signal, init.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      credentials,
      signal: timeout.signal,
      body: method === 'GET' ? undefined : JSON.stringify(init.json ?? {}),
    });
  } catch (err) {
    timeout.done();
    if (init.signal?.aborted) throw err;
    throw new ApiError(0, 'offline', 'offline');
  }
  timeout.done();

  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const problem = (body ?? {}) as { code?: string; title?: string; detail?: string };
    const retry = Number(res.headers.get('retry-after'));
    throw new ApiError(
      res.status,
      problem.code,
      problem.detail ?? problem.title ?? `HTTP ${res.status}`,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }
  return body as T;
}
