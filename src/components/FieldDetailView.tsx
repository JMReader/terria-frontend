"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { FieldItem } from "@/data/fieldsData";

gsap.registerPlugin(useGSAP);

export interface FieldDetailViewProps {
  field: FieldItem;
  onBack: () => void;
  onOpenPassport?: () => void;
}

const DefRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-piedra-soft/70 last:border-0">
    <dt className="text-[11px] font-mono uppercase tracking-wider text-piedra shrink-0">{label}</dt>
    <dd className="text-sm font-semibold text-bosque text-right tabular-nums">{children}</dd>
  </div>
);

/**
 * Panel del explorador reducido a identidad mínima + CTA al pasaporte digital.
 * La vista completa (timelapse, futurología, what-if, certificado) vive en /parcela/[id].
 */
export default function FieldDetailView({
  field,
  onBack,
  onOpenPassport,
}: FieldDetailViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        containerRef.current,
        { autoAlpha: 0, scale: 0.98 },
        { autoAlpha: 1, scale: 1, duration: 0.35, ease: "power3.out" }
      );
    },
    { dependencies: [field.id], scope: containerRef }
  );

  const handleBackClick = () => {
    if (!containerRef.current) return onBack();
    gsap.to(containerRef.current, {
      autoAlpha: 0,
      scale: 0.98,
      duration: 0.2,
      ease: "power2.in",
      onComplete: onBack,
    });
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-piedra-soft bg-papel shadow-sm select-none"
    >
      {/* Header: volver + nombre + badge */}
      <div className="shrink-0 border-b border-piedra-soft p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBackClick}
            className="text-xs font-mono font-bold text-bosque/70 hover:text-bosque transition-colors cursor-pointer"
          >
            ‹ Catálogo
          </button>
          <span className="flex items-center gap-1 rounded-full bg-musgo/10 border border-musgo/25 px-2.5 py-0.5 text-[10px] font-mono font-bold text-musgo uppercase tracking-wider">
            <ShieldCheck className="h-3 w-3" />
            Verificado
          </span>
        </div>
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-bosque">
            {field.name}
          </h1>
          <p className="mt-0.5 text-xs font-mono text-piedra">
            {field.locality || "Argentina"}
            {field.province ? `, ${field.province}` : ""}
            {field.coordinates ? ` · ${field.coordinates}` : ""}
          </p>
        </div>
      </div>

      {/* Identidad mínima */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
        <dl>
          <DefRow label="Superficie">{field.hectares} ha</DefRow>
          <DefRow label="Cultivo">{field.primaryCrop || field.crop || "—"}</DefRow>
          <DefRow label="NDVI">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    field.ndvi > 0.6 ? "#4a6b46" : field.ndvi > 0.4 ? "#8a9a6b" : "#c9b28a",
                }}
              />
              {field.ndvi.toFixed(2)}
            </span>
          </DefRow>
          <DefRow label="Suelo">{field.soilSeries || field.soilType || "—"}</DefRow>
        </dl>

        <p className="mt-6 text-[11px] font-mono leading-relaxed text-piedra">
          Diorama 3D, timelapse satelital, futurología de valor, simulador what-if
          y certificado blockchain viven en el pasaporte digital de esta parcela.
        </p>
      </div>

      {/* CTA al pasaporte */}
      {onOpenPassport && (
        <div className="shrink-0 border-t border-piedra-soft p-4 sm:p-5">
          <button
            type="button"
            onClick={onOpenPassport}
            className="flex w-full items-center justify-between rounded-2xl bg-bosque px-4 py-3 text-sm font-semibold text-nube transition-colors hover:bg-bosque-deep cursor-pointer"
          >
            <span>Abrir pasaporte digital</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
