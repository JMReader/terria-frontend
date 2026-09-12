"use client";

import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ExternalLink } from "lucide-react";
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
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

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const shortHash = `${certification.snapshotHash.slice(0, 10)}...${certification.snapshotHash.slice(-8)}`;
  const txSignature = certification.txSignature;
  const shortTx = txSignature
    ? `${txSignature.slice(0, 10)}...${txSignature.slice(-8)}`
    : null;
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
          {certification.isDemo && (
            <span className="rounded-full border border-piedra-soft bg-nube px-2 py-0.5 text-[9px] font-mono font-bold text-piedra tracking-wider uppercase">
              demo
            </span>
          )}
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="rounded-full bg-tierra/15 border border-tierra/50 px-2 py-0.5 text-[9px] font-mono font-bold text-tierra-deep tracking-wider uppercase">
            {clusterLabel}
          </span>
        </div>
      </div>

      {/* Audit Rows */}
      <div className="py-3 space-y-3">
        {/* Snapshot Hash */}
        <div className="rounded-xl bg-nube border border-piedra-soft p-2.5 transition-colors group-hover:bg-tierra/10">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold text-piedra uppercase tracking-wider">
              Snapshot Hash (SHA-256)
            </span>
            <button
              onClick={() => handleCopy(certification.snapshotHash, "hash")}
              className="text-[9px] font-mono font-bold text-bosque/60 hover:text-bosque transition-colors uppercase cursor-pointer"
            >
              {copiedField === "hash" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-bosque break-all">
            {shortHash}
          </div>
        </div>

        {/* Solana Memo Transaction */}
        <div className="rounded-xl bg-nube border border-piedra-soft p-2.5 transition-colors group-hover:bg-tierra/10">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold text-piedra uppercase tracking-wider">
              Tx Signature (Memo Program)
            </span>
            {txSignature && (
              <button
                onClick={() => handleCopy(txSignature, "tx")}
                className="text-[9px] font-mono font-bold text-bosque/60 hover:text-bosque transition-colors uppercase cursor-pointer"
              >
                {copiedField === "tx" ? "Copiado" : "Copiar"}
              </button>
            )}
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-tierra-deep break-all">
            {shortTx ?? "Anclaje pendiente — sin firma todavía"}
          </div>
          {certification.memoPayload && (
            <div className="mt-1.5 truncate font-mono text-[9px] text-piedra" title={certification.memoPayload}>
              memo: {certification.memoPayload}
            </div>
          )}
        </div>

        {/* Slot & Campaign */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="rounded-lg bg-nube p-2 border border-piedra-soft">
            <span className="text-piedra block text-[8px] uppercase">Slot On-Chain</span>
            <span className="font-bold text-bosque/80">{certification.slot ?? "—"}</span>
          </div>
          <div className="rounded-lg bg-nube p-2 border border-piedra-soft">
            <span className="text-piedra block text-[8px] uppercase">Período</span>
            <span className="font-bold text-bosque/80">{certification.campaign}</span>
          </div>
        </div>

        {/* Cadena mensual — certificación viva */}
        {versions && versions.length > 0 && (
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
                  <ExternalLink className="h-3 w-3 shrink-0 text-piedra" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Explorer Link CTA */}
      <div className="border-t border-piedra-soft pt-3">
        {certification.explorerUrl ? (
          <a
            href={certification.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-xl bg-bosque hover:bg-bosque-deep text-nube px-3 py-2 text-xs font-mono font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.99]"
          >
            Ver en Solana Explorer
          </a>
        ) : (
          <span className="flex w-full items-center justify-center rounded-xl border border-piedra-soft bg-nube px-3 py-2 text-xs font-mono font-bold tracking-wider uppercase text-piedra">
            Sin ancla on-chain todavía
          </span>
        )}
      </div>
    </div>
  );
}
