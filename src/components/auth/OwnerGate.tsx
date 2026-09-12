"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { useOwnerAuth } from "./OwnerAuthProvider";

/**
 * Guarda de rutas del dueño: sin sesión → /ingresar?next=<ruta actual>.
 * Offline (backend caído con sesión previa guardada) deja pasar igual —
 * las vistas muestran su propio estado de error sin datos mock.
 */
export default function OwnerGate({ children }: { children: React.ReactNode }) {
  const { status } = useOwnerAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "anonymous") {
      const qs = searchParams.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      router.replace(`/ingresar?next=${encodeURIComponent(target)}`);
    }
  }, [status, router, pathname, searchParams]);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-nube text-bosque/60">
        <div className="flex flex-col items-center gap-2 font-mono text-xs">
          <Lock className="h-5 w-5 animate-pulse text-musgo" />
          <span>Verificando sesión…</span>
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-nube text-bosque/60 font-mono text-xs">
        Redirigiendo a ingreso…
      </div>
    );
  }

  return <>{children}</>;
}
