"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Unplug } from "lucide-react";
import { useOwnerAuth } from "@/components/auth/OwnerAuthProvider";
import { useOwnerFields } from "@/hooks/useOwnerFields";
import OwnerParcelList from "@/components/owner/OwnerParcelList";
import SessionStatus from "@/components/auth/SessionStatus";
import { OwnerFieldRow } from "@/types/passport";

export default function MisParcelasView() {
  const { owner, status: authStatus } = useOwnerAuth();
  const { fields, source, copyPublicLink, unshare } = useOwnerFields();
  const router = useRouter();

  const open = (field: OwnerFieldRow) => router.push(`/parcela/${field.id}`);

  return (
    <div className="min-h-screen w-full bg-nube text-bosque">
      <header className="sticky top-0 z-40 border-b border-piedra-soft/70 bg-nube/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-bosque">
            TERRIA
          </Link>
          <SessionStatus />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-musgo">
              Panel del dueño
            </p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-bosque">
              Mis parcelas
            </h1>
            <p className="mt-1 text-xs font-mono text-piedra">
              {owner?.name || owner?.email}
              {authStatus === "offline" ? " · sin conexión" : ""} · {fields.length} cargadas
              {source === "error" ? " (error de conexión)" : ""}
            </p>
          </div>
          <Link
            href="/#explorador"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-piedra-soft px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-bosque/70 transition-colors hover:bg-papel hover:text-bosque"
          >
            <MapPin className="h-3.5 w-3.5" />
            Explorador
          </Link>
        </div>

        {source === "loading" ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl border border-piedra-soft bg-papel"
              />
            ))}
          </div>
        ) : source === "error" ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-piedra-soft bg-papel py-14 text-center">
            <Unplug className="h-7 w-7 text-piedra-soft" />
            <p className="text-xs font-mono text-bosque/70">
              Sin conexión con el servidor TERRIA — no se pudieron cargar tus parcelas.
            </p>
          </div>
        ) : (
          <OwnerParcelList
            fields={fields}
            onOpen={open}
            onCopyLink={copyPublicLink}
            onUnshare={unshare}
          />
        )}

        <p className="mt-4 text-[10px] font-mono leading-relaxed text-piedra">
          «Copiar link» publica el pasaporte digital de la parcela y copia su URL pública.
          Cualquiera con el link puede verla en solo lectura. «Descompartir» la vuelve privada.
        </p>
      </main>
    </div>
  );
}
