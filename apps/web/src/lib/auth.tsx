"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  apiFetch,
  clearSession,
  getAccessToken,
  getStoredUser,
  setStoredUser,
  setTokens,
} from "@/lib/api";
import type { LoginResponse, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** true mientras se hidrata la sesión desde localStorage. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    setHasToken(true);
    // Hidratamos con el usuario cacheado y validamos contra la API.
    setUser(getStoredUser());
    setIsLoading(false);

    apiFetch<User>("/auth/me")
      .then((me) => {
        setUser(me);
        setStoredUser(me);
      })
      .catch((err: unknown) => {
        // Si la API no está disponible conservamos la sesión cacheada.
        // Un 401 ya fue manejado por apiFetch (limpieza + redirect).
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          setHasToken(false);
        }
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      setTokens(data.accessToken, data.refreshToken);
      setStoredUser(data.user);
      setUser(data.user);
      setHasToken(true);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch {
      // No bloqueamos el logout local si la API no responde.
    } finally {
      clearSession();
      setUser(null);
      setHasToken(false);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: hasToken || user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
