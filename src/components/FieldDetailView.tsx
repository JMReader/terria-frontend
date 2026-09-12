"use client";

import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight } from "lucide-react";
import { FieldItem } from "@/data/fieldsData";
import { DEMO_TIMELAPSE_MANIFEST } from "@/data/timelapseMockData";
import { useFieldTimelapse } from "@/hooks/useFieldTimelapse";
import NdviMetricCard from "@/components/timelapse/NdviMetricCard";
import WeatherDailyCard from "@/components/timelapse/WeatherDailyCard";
import NdviSparklineChart from "@/components/timelapse/NdviSparklineChart";
import TimelapseController from "@/components/timelapse/TimelapseController";

gsap.registerPlugin(useGSAP);

export interface FieldDetailViewProps {
  field: FieldItem;
  onBack: () => void;
  onExpandData?: () => void;
  sharedTimelapse?: ReturnType<typeof useFieldTimelapse>;
}

const DefRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-piedra-soft/70 last:border-0">
    <dt className="text-[11px] font-mono uppercase tracking-wider text-piedra shrink-0">{label}</dt>
    <dd className="text-sm font-semibold text-bosque text-right tabular-nums">{children}</dd>
  </div>
);

export default function FieldDetailView({
  field,
  onBack,
  onExpandData,
  sharedTimelapse,
}: FieldDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "timelapse">("summary");
  const containerRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  const internalTimelapse = useFieldTimelapse({ manifest: DEMO_TIMELAPSE_MANIFEST });
  const timelapse = sharedTimelapse || internalTimelapse;

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

  useGSAP(
    () => {
      if (tabContentRef.current) {
        gsap.fromTo(
          tabContentRef.current.children,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, stagger: 0.04, duration: 0.28, ease: "power2.out" }
        );
      }
    },
    { dependencies: [activeTab], scope: containerRef }
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
      {/* Header plano: volver + nombre + un solo badge */}
      <div className="shrink-0 border-b border-piedra-soft p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleBackClick}
            className="text-xs font-mono font-bold text-bosque/70 hover:text-bosque transition-colors cursor-pointer"
          >
            ‹ Catálogo
          </button>
          <span className="rounded-full bg-musgo/10 border border-musgo/25 px-2.5 py-0.5 text-[10px] font-mono font-bold text-musgo uppercase tracking-wider">
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

        <div className="grid grid-cols-2 gap-1 rounded-full bg-nube p-1 border border-piedra-soft text-[11px] font-mono font-bold uppercase">
          <button
            onClick={() => setActiveTab("summary")}
            className={`rounded-full py-1.5 transition-all cursor-pointer ${
              activeTab === "summary"
                ? "bg-papel text-bosque shadow-xs"
                : "text-piedra hover:text-bosque"
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab("timelapse")}
            className={`rounded-full py-1.5 transition-all cursor-pointer ${
              activeTab === "timelapse"
                ? "bg-papel text-musgo shadow-xs"
                : "text-piedra hover:text-bosque"
            }`}
          >
            Timelapse
          </button>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
        <div ref={tabContentRef} className="space-y-4">
          {activeTab === "summary" && (
            <>
              <dl>
                <DefRow label="Superficie">{field.hectares} ha</DefRow>
                <DefRow label="Cultivo">{field.primaryCrop || field.crop || "—"}</DefRow>
                <DefRow label="Aptitud">
                  {field.suitabilityScore != null ? `${field.suitabilityScore}% · ` : ""}
                  {field.aptitude || "Clase I-II"}
                </DefRow>
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
                <DefRow label="Napa">{field.waterTable || "Cota normal"}</DefRow>
                <DefRow label="Régimen">{field.irrigation ? "Riego pivote" : "Secano"}</DefRow>
                <DefRow label="Rinde ref.">{field.rentQqSoja != null ? `${field.rentQqSoja} qq/ha` : "N/D"}</DefRow>
              </dl>

              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-piedra mb-1.5">
                  Campañas
                </p>
                <div className="text-xs font-mono">
                  <div className="flex items-center justify-between py-1.5 border-b border-piedra-soft/60">
                    <span className="text-bosque/75">2024/25 · Maíz Tardío</span>
                    <span className="font-bold text-musgo tabular-nums">98 qq/ha</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-piedra-soft/60">
                    <span className="text-bosque/75">2023/24 · Soja 1ra</span>
                    <span className="font-bold text-bosque tabular-nums">41 qq/ha</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-bosque/75">2022/23 · Trigo / Soja</span>
                    <span className="font-bold text-bosque tabular-nums">44 qq/ha</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "timelapse" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NdviMetricCard timelineState={timelapse.timelineState} />
                <WeatherDailyCard
                  weather={timelapse.timelineState.weather}
                  selectedDate={timelapse.selectedDate}
                />
              </div>

              <NdviSparklineChart
                frames={timelapse.manifest?.frames || []}
                selectedDate={timelapse.selectedDate}
                activeFrameId={timelapse.timelineState.satellite?.id}
                onSelectDate={(d) => {
                  const idx = timelapse.dates.indexOf(d);
                  if (idx !== -1) timelapse.setDateIndex(idx);
                }}
              />

              <TimelapseController
                dates={timelapse.dates}
                dateIndex={timelapse.dateIndex}
                onDateIndexChange={timelapse.setDateIndex}
                timelineState={timelapse.timelineState}
                isPlaying={timelapse.isPlaying}
                onTogglePlay={() => timelapse.setIsPlaying(!timelapse.isPlaying)}
                speed={timelapse.speed}
                onSpeedChange={timelapse.setSpeed}
                activeLayer={timelapse.activeLayer}
                onLayerChange={timelapse.setActiveLayer}
                onStepNext={timelapse.stepNext}
                onStepPrev={timelapse.stepPrev}
                onJumpObservation={timelapse.jumpToObservation}
                className="shadow-none"
              />
            </>
          )}
        </div>
      </div>

      {/* Footer mínimo: solo abre la vista ampliada */}
      {onExpandData && (
        <div className="shrink-0 border-t border-piedra-soft px-4 sm:px-5 py-3">
          <button
            onClick={onExpandData}
            className="flex w-full items-center justify-between text-xs font-mono font-bold text-bosque/70 hover:text-bosque transition-colors cursor-pointer"
          >
            <span>Ampliar datos · Futuro y Solana</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
