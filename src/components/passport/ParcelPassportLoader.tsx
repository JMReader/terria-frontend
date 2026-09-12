"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPinOff } from "lucide-react";
import { PassportMode } from "@/types/passport";
import { useParcelPassport } from "@/hooks/useParcelPassport";
import { useOwnerAuth } from "@/components/auth/OwnerAuthProvider";
import ParcelPassportView from "./ParcelPassportView";

interface ParcelPassportLoaderProps {
  id?: string;
  slug?: string;
  mode: PassportMode;
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-nube px-4 text-center">
      <MapPinOff className="h-8 w-8 text-piedra" />
      <p className="font-display text-2xl text-bosque">{message}</p>
      <Link
        href="/"
        className="mt-2 text-xs font-mono font-bold uppercase tracking-wider text-musgo hover:underline"
      >
        ‹ Volver al explorador
      </Link>
    </div>
  );
}

/**
 * Resuelve la parcela y decide el acceso:
 *  - owner: solo el dueño ve el pasaporte; ajena publicada → redirect /p/{slug}; ajena privada → no disponible.
 *  - public: cualquiera con el slug válido.
 */
export default function ParcelPassportLoader({ id, slug, mode }: ParcelPassportLoaderProps) {
  const { field, shareState, source, copyPublicLink, unshare } = useParcelPassport({
    id,
    slug,
    mode,
  });
  const { owner, status: authStatus } = useOwnerAuth();
  const router = useRouter();

  const isForeign =
    mode === "owner" &&
    authStatus !== "loading" &&
    field?.ownerId != null &&
    owner != null &&
    field.ownerId !== owner.id;

  const foreignPublicUrl =
    isForeign && shareState.isPublished && shareState.publicSlug
      ? `/p/${shareState.publicSlug}`
      : null;

  useEffect(() => {
    if (foreignPublicUrl) router.replace(foreignPublicUrl);
  }, [foreignPublicUrl, router]);

  if (source === "loading" || (mode === "owner" && authStatus === "loading")) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-nube text-bosque/60">
        <div className="flex flex-col items-center gap-2 font-mono text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-musgo" />
          <span>Cargando pasaporte…</span>
        </div>
      </div>
    );
  }

  if (!field || source === "not-found" || source === "forbidden" || source === "error") {
    return (
      <Unavailable
        message={
          source === "error"
            ? "Sin conexión con el servidor TERRIA"
            : mode === "public"
              ? "Pasaporte no disponible"
              : "Parcela no encontrada"
        }
      />
    );
  }

  if (isForeign) {
    if (foreignPublicUrl) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-nube font-mono text-xs text-bosque/60">
          Redirigiendo a la vista pública…
        </div>
      );
    }
    return <Unavailable message="Esta parcela es privada y no te pertenece" />;
  }

  return (
    <ParcelPassportView
      field={field}
      mode={mode}
      source={source}
      shareState={shareState}
      onCopyLink={mode === "owner" ? copyPublicLink : undefined}
      onUnshare={mode === "owner" ? unshare : undefined}
    />
  );
}
