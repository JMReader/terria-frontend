"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useOwnerAuth } from "./OwnerAuthProvider";
import BrandMark from "@/components/brand/BrandMark";

interface AuthViewProps {
  next: string | null;
}

type Mode = "login" | "register";

const inputCls =
  "w-full rounded-xl border border-piedra-soft bg-nube px-3.5 py-2.5 text-sm text-bosque placeholder:text-piedra focus:border-musgo focus:outline-none transition-colors";

export default function AuthView({ next }: AuthViewProps) {
  const { status, login, register } = useOwnerAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = next && next.startsWith("/") ? next : "/mis-parcelas";

  useEffect(() => {
    if (status === "authenticated") router.replace(destination);
  }, [status, router, destination]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim() || undefined);
      }
      router.replace(destination);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "INVALID_CREDENTIALS") setError("Email o contraseña incorrectos.");
      else if (code === "EMAIL_TAKEN") setError("Ya existe una cuenta con ese email.");
      else setError("No pudimos completar el ingreso. ¿Está levantado el backend?");
    } finally {
      setBusy(false);
    }
  };

  const tabCls = (m: Mode) =>
    `rounded-full py-1.5 transition-all cursor-pointer ${
      mode === m ? "bg-papel text-bosque shadow-xs" : "text-piedra hover:text-bosque"
    }`;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-nube px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark />
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight text-bosque">
              {mode === "login" ? "Ingresá a tu cuenta" : "Creá tu cuenta de dueño"}
            </h1>
            <p className="mt-1 text-xs font-mono text-piedra">
              Gestioná tus parcelas y decidí con quién compartirlas.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-piedra-soft bg-papel p-5 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-nube p-1 border border-piedra-soft text-[11px] font-mono font-bold uppercase">
            <button type="button" onClick={() => setMode("login")} className={tabCls("login")}>
              Ingresar
            </button>
            <button type="button" onClick={() => setMode("register")} className={tabCls("register")}>
              Crear cuenta
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre (opcional)"
                className={inputCls}
                autoComplete="name"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={inputCls}
              autoComplete="email"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña (mín. 8)"
              className={inputCls}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {error && (
              <p className="rounded-xl border border-tierra/40 bg-tierra/10 px-3 py-2 text-xs font-mono text-tierra-deep">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-bosque px-4 py-2.5 text-sm font-semibold text-nube transition-colors hover:bg-bosque-deep disabled:opacity-60 cursor-pointer"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {mode === "login" ? "Ingresar" : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] font-mono text-piedra">
          Demo local: dueno@terria.dev / terria1234
        </p>
      </div>
    </div>
  );
}
