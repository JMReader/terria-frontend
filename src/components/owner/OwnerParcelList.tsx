"use client";

import React, { useState } from "react";
import {
  ArrowUpRight,
  Check,
  EyeOff,
  Link2,
  Loader2,
} from "lucide-react";
import { OwnerFieldRow } from "@/types/passport";

interface OwnerParcelListProps {
  fields: OwnerFieldRow[];
  onOpen: (field: OwnerFieldRow) => void;
  onCopyLink: (field: OwnerFieldRow) => Promise<string | null>;
  onUnshare: (field: OwnerFieldRow) => Promise<void>;
}

const ndviDot = (v: number) =>
  v > 0.6 ? "#4a6b46" : v > 0.4 ? "#8a9a6b" : "#c9b28a";

function Row({
  field,
  onOpen,
  onCopyLink,
  onUnshare,
}: OwnerParcelListProps & { field: OwnerFieldRow }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"copy" | "unshare" | null>(null);
  const { isPublished, status } = field.shareState;

  const copy = async () => {
    setBusy("copy");
    const url = await onCopyLink(field);
    setBusy(null);
    if (url) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const unshare = async () => {
    setBusy("unshare");
    await onUnshare(field);
    setBusy(null);
  };

  return (
    <div className="field-card-item flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: ndviDot(field.ndvi) }}
      />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-bosque">
          {field.name}
        </span>
        <span className="block truncate text-[11px] text-piedra tabular-nums">
          {field.locality || "Argentina"}
          {field.province ? `, ${field.province}` : ""} · {field.hectares} ha
        </span>
      </div>

      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
          isPublished
            ? "border-musgo/25 bg-musgo/10 text-musgo"
            : "border-piedra-soft bg-nube text-piedra"
        }`}
      >
        {status === "pending" ? "…" : isPublished ? "Pública" : "Privada"}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onOpen(field)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-bosque/70 transition-colors hover:bg-nube hover:text-bosque cursor-pointer"
        >
          Pasaporte
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={copy}
          disabled={busy !== null}
          className="flex items-center gap-1 rounded-full bg-musgo/10 border border-musgo/25 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-musgo transition-colors hover:bg-musgo/20 disabled:opacity-60 cursor-pointer"
        >
          {busy === "copy" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar link"}
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
          </button>
        )}
      </div>
    </div>
  );
}

export default function OwnerParcelList(props: OwnerParcelListProps) {
  const { fields, onOpen } = props;

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-piedra-soft bg-papel py-16 text-center">
        <p className="font-display text-xl text-bosque">Todavía no tenés parcelas cargadas</p>
        <p className="mt-1 max-w-xs text-xs font-mono text-piedra">
          Cuando el equipo cargue campos a tu cuenta, van a aparecer acá con su estado de compartición.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-piedra-soft/70 overflow-hidden rounded-3xl border border-piedra-soft bg-papel shadow-sm">
      {fields.map((field) => (
        <Row key={field.id} {...props} field={field} onOpen={onOpen} />
      ))}
    </div>
  );
}
