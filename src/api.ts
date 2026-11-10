const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000/api" : "/api")
).replace(/\/+$/, "");
const AUTH_TOKEN_KEY = "musikAralanApiToken";

const apiWatchers = new Map<string, Set<() => void>>();
export interface RealtimeDataChange {
  topics: string[];
  classId: number | null;
}

const realtimeListeners = new Set<(change: RealtimeDataChange) => void>();
let activeApiRequests = 0;
const apiActivityListeners = new Set<(activeRequests: number) => void>();

function notifyApiActivity() {
  for (const listener of apiActivityListeners) {
    listener(activeApiRequests);
  }
}

export function getActiveApiRequestCount() {
  return activeApiRequests;
}

export function subscribeToApiActivity(
  listener: (activeRequests: number) => void,
) {
  apiActivityListeners.add(listener);
  listener(activeApiRequests);
  return () => {
    apiActivityListeners.delete(listener);
  };
}

export function setApiToken(token: string) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearApiToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function hasApiToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY) !== null;
}

export function getApiToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  try {
    activeApiRequests += 1;
    notifyApiActivity();

    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
    const responseText = await response.text();
    let payload: unknown;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new ApiError(
          `The API returned an invalid response (${response.status}). Check the API URL and server configuration.`,
          response.status,
        );
      }
    }
    if (!response.ok) {
      if (response.status === 401 && token) {
        clearApiToken();
        localStorage.removeItem("role");
        localStorage.removeItem("uid");
        localStorage.removeItem("name");
        localStorage.removeItem("birthYear");
        if (
          window.location.pathname !== "/login" &&
          window.location.pathname !== "/reset-password" &&
          window.location.pathname !== "/forgot-password"
        ) {
          window.location.assign("/login");
        }
      }
      const body =
        payload && typeof payload === "object"
          ? (payload as { message?: string; code?: string })
          : {};
      throw new ApiError(
        body.message || `Request failed with status ${response.status}.`,
        response.status,
        body.code,
      );
    }
    return payload as T;
  } finally {
    activeApiRequests -= 1;
    notifyApiActivity();
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, data?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export function apiPut<T>(path: string, data: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PUT", body: JSON.stringify(data) });
}

export function apiPatch<T>(path: string, data: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(data) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}

export function refreshApi(path: string) {
  for (const [watchedPath, refreshers] of apiWatchers) {
    if (watchedPath === path || watchedPath.startsWith(`${path}?`)) {
      refreshers.forEach((refresh) => refresh());
    }
  }
}

export function refreshAllApiWatchers() {
  apiWatchers.forEach((refreshers) => refreshers.forEach((refresh) => refresh()));
}

export function subscribeToRealtimeDataChanges(
  listener: (change: RealtimeDataChange) => void,
) {
  realtimeListeners.add(listener);
  return () => {
    realtimeListeners.delete(listener);
  };
}

export function handleRealtimeDataChange(change: RealtimeDataChange) {
  for (const listener of realtimeListeners) {
    listener(change);
  }
  for (const topic of change.topics) {
    const path = change.classId === null
      ? topic
      : topic.replace(/\{classId\}/g, String(change.classId));
    if (!path.includes("{")) refreshApi(path);
  }
}

export function watchApi<T>(
  path: string,
  onData: (payload: T) => void,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;
  let running = false;
  let refreshPending = false;
  const load = async (force = false) => {
    if (stopped) return;
    if (running) {
      if (force) refreshPending = true;
      return;
    }
    running = true;
    try {
      const payload = await apiGet<T>(path);
      if (!stopped) onData(payload);
    } catch (error) {
      if (!stopped) onError(error);
    } finally {
      running = false;
      if (!stopped && refreshPending) {
        refreshPending = false;
        void load();
      }
    }
  };
  const refresh = () => void load(true);
  const watchers = apiWatchers.get(path) || new Set<() => void>();
  watchers.add(refresh);
  apiWatchers.set(path, watchers);
  void load();
  return () => {
    stopped = true;
    watchers.delete(refresh);
    if (watchers.size === 0) apiWatchers.delete(path);
  };
}
