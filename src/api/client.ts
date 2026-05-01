// Shared fetch wrapper — same-origin by default, can be overridden by
// VITE_API_BASE at build time (see build.ts). Session cookie flows
// naturally when same-origin; an optional X-API-Key header lets a
// kiosk URL (?key=...) skip the login screen.

declare const __API_BASE__: string | undefined;

let apiKey: string | null = null;

export function setApiKey(key: string | null) {
  apiKey = key;
}

// Precedence: runtime window.__API_BASE__ (injected by apteva-server's
// simple handler) > build-time __API_BASE__ constant > "/api". Runtime
// wins so a single prebuilt image can be deployed against many servers.
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const w = (window as any).__API_BASE__;
    if (typeof w === "string" && w) return w;
  }
  try {
    if (typeof __API_BASE__ !== "undefined" && __API_BASE__) return __API_BASE__;
  } catch {}
  return "/api";
}

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`${status}: ${body}`);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const h = new Headers(init?.headers);
  if (!h.has("Accept")) h.set("Accept", "application/json");
  if (init?.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (apiKey) h.set("X-API-Key", apiKey);
  return h;
}

export async function apiFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const url = getApiBase() + path;
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: buildHeaders(init),
  });
  if (res.status === 401) {
    if (onUnauthorized) onUnauthorized();
    const body = await res.text().catch(() => "");
    throw new ApiError(401, body || "unauthorized");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }
  const ct = res.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

// Build an SSE URL (EventSource can't send custom headers, so the API
// key must travel as a query param; the server auth middleware accepts
// either cookie or key= param).
export function sseUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(getApiBase() + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  if (apiKey) url.searchParams.set("api_key", apiKey);
  return url.toString();
}
