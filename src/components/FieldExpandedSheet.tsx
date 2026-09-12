"use client";

/**
 * FieldExpandedSheet — vista ampliada de datos del campo.
 *
 * Sheet lateral que concentra lo que antes eran tabs apretados en el panel:
 * Datos (ficha completa), Futuro (proyector de valor) y Solana (auditoría).
 * Una sola superficie flotante — se cierra con X, Escape o clic afuera.
 */

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { X } from "lucide-react";
import { FieldItem } from "@/data/fieldsData";
import { DEMO_SOLANA_CERTIFICATION } from "@/data/timelapseMockData";
import MetricStatBox from "@/components/ui/MetricStatBox";
import SolanaAuditCard from "@/components/certification/SolanaAuditCard";
import ValuationPanel from "@/components/valuation/ValuationPanel";

gsap.registerPlugin(useGSAP);

type SheetTab = "datos" | "future" | "audit";

export interface FieldExpandedSheetProps {
  field: FieldItem;
  open: boolean;
  onClose: () => void;
}

export default function FieldExpandedSheet({ field, open, onClose }: FieldExpandedSheetProps) {
  const [tab, setTab] = useState<SheetTab>("datos");
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useGSAP(
    () => {
      if (!open) return;
      gsap.fromTo(backdropRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 });
      gsap.fromTo(
        panelRef.current,
        { x: 48, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.4, ease: "power3.out" }
      );
    },
    { dependencies: [open] }
  );

  if (!open) return null;

  const tabBtn = (id: SheetTab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`rounded-xl px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
        tab === id
          ? "bg-bosque text-nube"
          : "text-piedra hover:text-bosque"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        ref={backdropRef}
        onClick={onClose}
        className="absolute inset-0 bg-bosque-deep/25 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Datos ampliados de ${field.name}`}
        className="absolute right-0 top-0 h-full w-[min(620px,94vw)] bg-papel border-l border-piedra-soft shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-piedra-soft p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-musgo">
              Datos ampliados
            </p>
            <h2 className="font-display text-xl font-medium text-bosque tracking-tight truncate">
              {field.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 text-piedra hover:bg-nube hover:text-bosque transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-4 sm:px-5 pt-3 pb-2 flex items-center gap-1 border-b border-piedra-soft">
          {tabBtn("datos", "Datos")}
          {tabBtn("future", "Futuro")}
          {tabBtn("audit", "Solana")}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          {tab === "datos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <MetricStatBox
                  label="Superficie"
                  value={field.hectares}
                  unit="ha"
                  subtext={field.primaryCrop || field.crop || "Cultivo activo"}
                  highlight="neutral"
                />
                <MetricStatBox
                  label="Aptitud"
                  value={field.suitabilityScore != null ? `${field.suitabilityScore}%` : (field.aptitude || "Alta")}
                  subtext="Clase I-II Agrícola"
                  progressPercent={field.suitabilityScore ?? 90}
                  highlight="emerald"
                />
                <MetricStatBox
                  label="NDVI Activo"
                  value={field.ndvi.toFixed(2)}
                  unit="/ 1.00"
                  progressPercent={field.ndvi * 100}
                  highlight="emerald"
                />
                <MetricStatBox
                  label="Alquiler"
                  value={field.rentQqSoja ?? "-"}
                  unit="qq/ha"
                  subtext={field.rentUsdHa != null ? `$${field.rentUsdHa} USD/ha` : "A consultar"}
                  highlight="blue"
                />
              </div>

              <div className="rounded-2xl border border-piedra-soft bg-papel p-4">
                <div className="flex items-center justify-between border-b border-piedra-soft pb-2">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-piedra uppercase">
                    Suelo & Napa (INTA)
                  </span>
                  <span className="text-[10px] font-mono text-bosque/60">
                    {field.soilSeries || field.soilType || "Suelo agrícola"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
                  <div className="rounded-xl bg-nube p-2.5 border border-piedra-soft">
                    <span className="text-[9px] text-piedra uppercase block">Napa Freática</span>
                    <span className="font-bold text-bosque">{field.waterTable || "Cota normal"}</span>
                  </div>
                  <div className="rounded-xl bg-nube p-2.5 border border-piedra-soft">
                    <span className="text-[9px] text-piedra uppercase block">Régimen Hídrico</span>
                    <span className="font-bold text-bosque">
                      {field.irrigation ? "Riego Pivote" : "Secano"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-piedra-soft bg-papel p-4">
                <span className="text-[10px] font-mono font-bold tracking-wider text-piedra uppercase block mb-3">
                  Historial de Campañas
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-piedra-soft pb-2">
                    <span className="text-bosque/80">2024/25 • Maíz Tardío</span>
                    <span className="font-bold text-musgo">98 qq/ha</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-piedra-soft pb-2">
                    <span className="text-bosque/80">2023/24 • Soja 1ra</span>
                    <span className="font-bold text-cielo-deep">41 qq/ha</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-bosque/80">2022/23 • Trigo / Soja</span>
                    <span className="font-bold text-tierra-deep">44 qq/ha</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "future" && <ValuationPanel field={field} />}

          {tab === "audit" && (
            <div className="space-y-4">
              <SolanaAuditCard certification={DEMO_SOLANA_CERTIFICATION} />
              <div className="rounded-2xl border border-piedra-soft bg-papel p-4">
                <span className="text-[10px] font-mono font-bold tracking-wider text-piedra uppercase block mb-2">
                  Regla de Integridad Criptográfica
                </span>
                <p className="text-xs font-mono text-bosque/70 leading-relaxed">
                  El snapshot canónico mensual (2018-2026) queda sellado bajo SHA-256 e inyectado en el Memo Program de Solana Devnet. La firma demuestra existencia inmutable de la serie agronómica.
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-piedra border-t border-piedra-soft pt-2">
                  <span>RFC 8785 (JCS)</span>
                  <span className="text-musgo font-bold">Estado: Confirmado</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
