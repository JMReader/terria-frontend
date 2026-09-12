"use client";

import React, { useState } from "react";
import { Check, EyeOff, Link2, Loader2 } from "lucide-react";
import { ShareState } from "@/types/passport";

interface SharePanelProps {
  shareState: ShareState;
  onCopyLink: () => Promise<string | null>;
  onUnshare: () => Promise<void>;
}

/**
 * Control de compartición del dueño: "Copiar link público" publica si hace
 * falta y copia /p/{slug}; "Descompartir" revoca el acceso.
 */
export default function SharePanel({ shareState, onCopyLink, onUnshare }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"copy" | "unshare" | null>(null);
  const { isPublished, status, publicSlug } = shareState;

  const copy = async () => {
    setBusy("copy");
    const url = await onCopyLink();
    setBusy(null);
    if (url) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const unshare = async () => {
    setBusy("unshare");
    await onUnshare();
    setBusy(null);
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
          isPublished
            ? "border-musgo/25 bg-musgo/10 text-musgo"
            : "border-piedra-soft bg-nube text-piedra"
        }`}
      >
        {status === "pending" ? "…" : isPublished ? "Pública" : "Privada"}
      </span>

      {isPublished && publicSlug && (
        <span className="hidden md:inline max-w-[180px] truncate text-[10px] font-mono text-piedra">
          /p/{publicSlug}
        </span>
      )}

      <button
        type="button"
        onClick={copy}
        disabled={busy !== null}
        className="flex items-center gap-1.5 rounded-full bg-musgo/10 border border-musgo/25 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-musgo transition-colors hover:bg-musgo/20 disabled:opacity-60 cursor-pointer"
      >
        {busy === "copy" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        {copied ? "¡Link copiado!" : "Copiar link"}
      </button>

      {isPublished && (
        <button
          type="button"
          onClick={unshare}
          disabled={busy !== null}
          aria-label="Descompartir — el link público deja de funcionar"
          title="Descompartir — el link público deja de funcionar"
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-piedra transition-colors hover:bg-nube hover:text-bosque disabled:opacity-60 cursor-pointer"
        >
          {busy === "unshare" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Descompartir</span>
        </button>
      )}
    </div>
  );
}
