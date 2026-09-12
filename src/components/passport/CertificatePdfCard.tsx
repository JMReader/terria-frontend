"use client";

import React, { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

interface CertificatePdfCardProps {
  /** `/v1/public/certifications/{cert_uid}.pdf` — null si el campo no tiene certificación. */
  pdfUrl: string | null;
  /** `/cert/{cert_uid}` — ficha HTML print-ready del certificado. */
  certPageUrl?: string | null;
  publicUrl?: string | null;
  loading?: boolean;
  className?: string;
}

type PdfStatus = "checking" | "ready" | "pending";

/**
 * Card del certificado blockchain: descarga el PDF real de la certificación
 * (snapshot hasheado + ancla Solana) generado por el backend.
 */
export default function CertificatePdfCard({
  pdfUrl,
  certPageUrl,
  publicUrl,
  loading = false,
  className = "",
}: CertificatePdfCardProps) {
  const [status, setStatus] = useState<PdfStatus>("checking");

  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    fetch(pdfUrl, { method: "GET", headers: { Range: "bytes=0-16" } })
      .then((res) => {
        if (cancelled) return;
        setStatus(res.ok ? "ready" : "pending");
      })
      .catch(() => !cancelled && setStatus("pending"));
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  return (
    <div className={`rounded-2xl border border-piedra-soft bg-papel p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tierra/15 border border-tierra/30">
            <FileText className="h-5 w-5 text-tierra-deep" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-bosque">Certificado blockchain PDF</p>
            <p className="truncate text-[11px] font-mono text-piedra">
              {pdfUrl
                ? publicUrl
                  ? `Acompaña al pasaporte público — ${publicUrl}`
                  : "Snapshot canónico anclado en Solana devnet"
                : "Todavía no hay certificación emitida para esta parcela"}
            </p>
          </div>
        </div>

        {loading || (pdfUrl && status === "checking") ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-piedra" />
        ) : pdfUrl && status === "ready" ? (
          <div className="flex shrink-0 items-center gap-2">
            {certPageUrl && (
              <a
                href={certPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-piedra-soft bg-nube px-3.5 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-bosque/80 transition-colors hover:text-bosque"
              >
                Ver ficha
              </a>
            )}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-bosque px-3.5 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-nube transition-colors hover:bg-bosque-deep"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar PDF
            </a>
          </div>
        ) : pdfUrl ? (
          <span className="shrink-0 rounded-full border border-piedra-soft bg-nube px-3.5 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-piedra">
            En generación…
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-piedra-soft bg-nube px-3.5 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-piedra">
            Sin certificado
          </span>
        )}
      </div>
    </div>
  );
}
