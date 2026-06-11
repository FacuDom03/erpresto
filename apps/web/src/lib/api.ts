/**
 * Cliente HTTP de ERPresto.
 *
 * - Base URL: NEXT_PUBLIC_API_URL (default http://localhost:3001).
 * - Inyecta Authorization: Bearer <accessToken>.
 * - Ante un 401 intenta refrescar el token UNA vez y reintenta la request.
 *   Si el refresh falla, limpia la sesión y redirige a /login.
 * - Tokens persistidos en localStorage.
 */

import type { RefreshResponse, User } from "@/lib/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ACCESS_TOKEN_KEY = "erpresto.accessToken";
const REFRESH_TOKEN_KEY = "erpresto.refreshToken";
const USER_KEY = "erpresto.user";

export const NETWORK_ERROR_MESSAGE = "No se pudo conectar con el servidor";

export class ApiError extends Error {
  /** Código HTTP. 0 indica error de red (servidor caído / sin conexión). */
  readonly status: number;
  /** Cuerpo JSON del error (si lo hubo). Útil para metadata como `orderId`. */
  readonly data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/** Mensaje legible de un error desconocido (ApiError → su message). */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Sesión (solo cliente)
// ---------------------------------------------------------------------------

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

// ---------------------------------------------------------------------------
// Refresh con vuelo único (varias requests 401 comparten el mismo refresh)
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as RefreshResponse;
        if (!data.accessToken || !data.refreshToken) return false;
        setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// apiFetch
// ---------------------------------------------------------------------------

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Si es false no se envía el Bearer ni se intenta refresh (login/refresh). */
  auth?: boolean;
  signal?: AbortSignal;
}

async function parseErrorBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    // cuerpo no-JSON
    return undefined;
  }
}

function errorMessageFrom(body: unknown, res: Response): string {
  const data = body as
    | { message?: string | string[]; error?: string }
    | undefined;
  if (typeof data?.message === "string") return data.message;
  if (Array.isArray(data?.message)) return data.message.join(". ");
  if (typeof data?.error === "string") return data.error;
  return `Error ${res.status}: ${res.statusText || "solicitud fallida"}`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      return await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ApiError(0, NETWORK_ERROR_MESSAGE);
    }
  };

  let res = await doFetch();

  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    }
    if (res.status === 401) {
      clearSession();
      redirectToLogin();
      throw new ApiError(401, "Sesión expirada. Iniciá sesión nuevamente.");
    }
  }

  if (!res.ok) {
    const errorBody = await parseErrorBody(res);
    throw new ApiError(res.status, errorMessageFrom(errorBody, res), errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
