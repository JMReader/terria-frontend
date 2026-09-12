"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { OwnerProfile } from "@/types/passport";
import {
  fetchOwnerMe,
  loginOwner,
  logoutOwner,
  registerOwner,
} from "@/lib/terriaApi";

const TOKEN_KEY = "terria.owner.token";
const OWNER_KEY = "terria.owner.profile";

export type OwnerAuthStatus = "loading" | "authenticated" | "anonymous" | "offline";

interface OwnerAuthContextValue {
  owner: OwnerProfile | null;
  token: string | null;
  status: OwnerAuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const OwnerAuthContext = createContext<OwnerAuthContextValue | null>(null);

export function OwnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<OwnerAuthStatus>("loading");
  const requestRef = useRef(0);

  // Restaurar sesión persistida y validarla contra el backend
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedOwner = localStorage.getItem(OWNER_KEY);
    const requestId = ++requestRef.current;
    queueMicrotask(() => {
      if (requestRef.current !== requestId) return;
      if (!savedToken) {
        setStatus("anonymous");
        return;
      }
      if (savedOwner) {
        try {
          setOwner(JSON.parse(savedOwner));
        } catch {
          /* perfil corrupto — se revalida igual */
        }
      }
    });
    if (!savedToken) return;
    fetchOwnerMe(savedToken)
      .then((fresh) => {
        if (requestRef.current !== requestId) return;
        setToken(savedToken);
        setOwner(fresh);
        localStorage.setItem(OWNER_KEY, JSON.stringify(fresh));
        setStatus("authenticated");
      })
      .catch(() => {
        if (requestRef.current !== requestId) return;
        // Backend caído con sesión previa: estado offline con el perfil guardado.
        setToken(savedToken);
        setStatus(savedOwner ? "offline" : "anonymous");
        if (!savedOwner) localStorage.removeItem(TOKEN_KEY);
      });
  }, []);

  const persist = useCallback((t: string, o: OwnerProfile) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(OWNER_KEY, JSON.stringify(o));
    setToken(t);
    setOwner(o);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token: t, owner: o } = await loginOwner({ email, password });
      persist(t, o);
    },
    [persist]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const { token: t, owner: o } = await registerOwner({ email, password, name });
      persist(t, o);
    },
    [persist]
  );

  const logout = useCallback(() => {
    if (token) void logoutOwner(token);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OWNER_KEY);
    setToken(null);
    setOwner(null);
    setStatus("anonymous");
  }, [token]);

  return (
    <OwnerAuthContext.Provider value={{ owner, token, status, login, register, logout }}>
      {children}
    </OwnerAuthContext.Provider>
  );
}

export function useOwnerAuth(): OwnerAuthContextValue {
  const ctx = useContext(OwnerAuthContext);
  if (!ctx) throw new Error("useOwnerAuth debe usarse dentro de <OwnerAuthProvider>");
  return ctx;
}
