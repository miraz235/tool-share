import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api, setToken, getToken } from "./api";
import type { AuthUser, AuthLoginResponse } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (u: AuthUser | null) => void;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get<AuthUser>("/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If returning from Google OAuth, AuthCallback handles it
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    if (getToken()) {
      checkAuth();
    } else {
      // No token: skip /auth/me probe to keep console clean on public pages
      setLoading(false);
    }
  }, [checkAuth]);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const res = await api.post<AuthLoginResponse>("/auth/login", { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (email: string, password: string, name: string): Promise<AuthUser> => {
    const res = await api.post<AuthLoginResponse>("/auth/register", { email, password, name });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Non-fatal: server may already have expired our session. We still clear local state.
      console.warn("[auth] logout request failed (continuing locally)", err);
    }
    setToken(null);
    setUser(null);
  };

  const updateUser = (u: AuthUser | null) => setUser(u);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refresh: checkAuth, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
