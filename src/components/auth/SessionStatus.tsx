"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { useOwnerAuth } from "./OwnerAuthProvider";

/**
 * Estado de sesión para el header: "Ingresar" o saludo + Mis parcelas + Salir.
 */
export default function SessionStatus() {
  const { owner, status, logout } = useOwnerAuth();
  const router = useRouter();

  if (status === "loading") {
    return <span className="h-6 w-16 animate-pulse rounded-full bg-nube" />;
  }

  if (status === "anonymous") {
    return (
      <Link
        href="/ingresar"
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-bosque/70 transition-colors hover:bg-nube hover:text-bosque"
      >
        <UserRound className="h-3.5 w-3.5" />
        Ingresar
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/mis-parcelas"
        className="rounded-full px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-bosque/70 transition-colors hover:bg-nube hover:text-bosque"
      >
        Mis parcelas
      </Link>
      <button
        onClick={() => {
          logout();
          router.push("/");
        }}
        title={owner?.email ?? ""}
        className="rounded-full px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-piedra transition-colors hover:bg-nube hover:text-bosque cursor-pointer"
      >
        Salir{owner?.name ? ` · ${owner.name.split(" ")[0]}` : ""}
      </button>
    </div>
  );
}
