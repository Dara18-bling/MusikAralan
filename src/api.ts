const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000/api" : "/api")
).replace(/\/+$/, "");
const AUTH_TOKEN_KEY = "musikAralanApiToken";

export const POLL_INTERVAL_DAY = 24 * 60 * 60 * 1000;
export const POLL_INTERVAL_TEN_MINUTES = 10 * 60 * 1000;
export const POLL_INTERVAL_TWO_MINUTES = 2 * 60 * 1000;

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
          window.location.pathname !== "/reset-password"
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

export function watchApi<T>(
  path: string,
  onData: (payload: T) => void,
  onError: (error: unknown) => void,
  intervalMs = POLL_INTERVAL_DAY,
): () => void {
  let stopped = false;
  let running = false;
  const load = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const payload = await apiGet<T>(path);
      if (!stopped) onData(payload);
    } catch (error) {
      if (!stopped) onError(error);
    } finally {
      running = false;
    }
  };
  void load();
  const timer = window.setInterval(() => void load(), intervalMs);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}
