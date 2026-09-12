"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SolanaCertification } from "@/types/terria";
import { CertificationVersion, VerifyStatus } from "@/types/certification";
import { certificationPageUrl } from "@/lib/terriaApi";

gsap.registerPlugin(useGSAP);

export interface SolanaAuditCardProps {
  certification: SolanaCertification;
  /** Cadena mensual (scope=month) — se lista debajo si viene. */
  versions?: CertificationVersion[];
  className?: string;
}

const VERIFY_BADGE: Record<VerifyStatus, { label: string; cls: string }> = {
  verified: {
    label: "Verificado on-chain",
    cls: "bg-musgo/15 border-musgo/40 text-musgo",
  },
  pending: {
    label: "Anclaje pendiente",
    cls: "bg-tierra/15 border-tierra/50 text-tierra-deep",
  },
  rpc_unavailable: {
    label: "RPC no disponible",
    cls: "bg-tierra/15 border-tierra/50 text-tierra-deep",
  },
  tampered: {
    label: "Alterado",
    cls: "bg-red-500/10 border-red-500/40 text-red-600",
  },
};

export default function SolanaAuditCard({
  certification,
  versions,
  className = "",
}: SolanaAuditCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 15 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out" }
      );
    },
    { scope: cardRef }
  );

  const verifyStatus: VerifyStatus =
    certification.verifyStatus ?? (certification.verified ? "verified" : "pending");
  const badge = VERIFY_BADGE[verifyStatus] ?? VERIFY_BADGE.pending;
  const clusterLabel = `Solana ${certification.cluster === "devnet" ? "Devnet" : certification.cluster}`;

  return (
    <div
      ref={cardRef}
      className={`group relative flex flex-col justify-between rounded-2xl border border-piedra-soft bg-papel p-4.5 shadow-xs transition-colors duration-200 hover:border-tierra-deep select-none ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-piedra-soft pb-2.5">
        <span className="text-[10px] font-mono font-bold tracking-wider text-piedra uppercase">
          Certificación Inmutable
          {certification.version != null && (
            <span className="ml-1.5 text-bosque/60">V{certification.version}</span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="rounded-full bg-tierra/15 border border-tierra/50 px-2 py-0.5 text-[9px] font-mono font-bold text-tierra-deep tracking-wider uppercase">
            {clusterLabel}
          </span>
        </div>
      </div>

      {/* Cadena mensual — certificación viva */}
      {versions && versions.length > 0 && (
        <div className="py-3">
          <div className="rounded-xl bg-nube border border-piedra-soft p-2.5">
            <span className="text-[9px] font-mono font-bold text-piedra uppercase tracking-wider block mb-1.5">
              Cadena mensual certificada
            </span>
            <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
              {versions.map((v) => (
                <a
                  key={v.id}
                  href={certificationPageUrl(v.certUid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 font-mono text-[10px] text-bosque/75 hover:bg-papel hover:text-bosque transition-colors"
                >
                  <span className="shrink-0 font-bold">
                    V{v.version} · {v.month}
                  </span>
                  <span className="truncate text-piedra">
                    {v.contentHash.slice(0, 8)}…{v.contentHash.slice(-6)}
                  </span>
                  <span className="shrink-0 rounded-full border border-piedra-soft bg-papel px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-bosque/70">
                    Certificación
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
