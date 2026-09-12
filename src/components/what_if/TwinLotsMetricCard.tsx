"use client";

import React from "react";
import { ModelMetrics } from "@/types/whatIf";

export interface TwinLotsMetricCardProps {
  metrics: ModelMetrics;
  targetYear: number;
  frozenInputs?: Record<string, unknown>;
  className?: string;
}

export default function TwinLotsMetricCard({
  metrics,
  targetYear,
  frozenInputs,
  className = "",
}: TwinLotsMetricCardProps) {
  const env = (frozenInputs?.environmental_vector_5d ?? {}) as Record<string, number | undefined>;
  const clayPct = env.soil_clay_pct ?? 26.6;
  const slopeDeg = env.mean_slope_deg ?? 0.4;
  const elevM = env.elevation_dem_m ?? 60.0;
  const radarDb = env.radar_backscatter_db ?? -17.4;
  const waterBalMm = env.water_balance_mm ?? (targetYear === 2023 ? -670 : -320);
  const ndviMax = env.historical_ndvi_max ?? 0.426;

  const dimensions = [
    {
      label: "Suelo",
      value: `${clayPct.toFixed(1)}% Arcilla · Franco Arcilloso`,
    },
    {
      label: "Topografía",
      value: `${elevM.toFixed(0)} msnm · Pendiente ${slopeDeg.toFixed(1)}°`,
    },
    {
      label: "Humedad",
      value: `${radarDb.toFixed(1)} dB`,
    },
    {
      label: "Balance Hídrico",
      value: `${waterBalMm > 0 ? `+${waterBalMm.toFixed(0)}` : waterBalMm.toFixed(0)} mm ${
        waterBalMm < -400 ? "(Déficit estival)" : "(Normal)"
      }`,
    },
    {
      label: "Historial NDVI",
      value: `${ndviMax.toFixed(3)} máx estival`,
    },
  ];

  return (
    <div
      className={`rounded-2xl border border-piedra-soft bg-papel p-4 shadow-xs transition-colors duration-200 hover:border-bosque/40 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-piedra-soft pb-2.5">
        <span className="text-[10px] font-mono font-bold tracking-wider text-piedra uppercase">
          Algoritmo Lotes Gemelos (Vector 5D)
        </span>
        <span className="text-[10px] font-mono text-musgo font-bold">
          Similitud {(metrics.avgSimilarityScore * 100).toFixed(1)}%
        </span>
      </div>

      {/* Grid de Métricas de Similitud Espacial */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs font-mono">
        <div className="rounded-xl bg-nube p-2.5 border border-piedra-soft text-center">
          <span className="text-[9px] text-piedra uppercase block">Candidatos (50 km)</span>
          <span className="font-bold text-bosque text-sm">{metrics.candidateLotsScanned}</span>
        </div>

        <div className="rounded-xl bg-nube p-2.5 border border-piedra-soft text-center">
          <span className="text-[9px] text-piedra uppercase block">Gemelos Calibrados</span>
          <span className="font-bold text-musgo text-sm">{metrics.strictTwinLotsMatched}</span>
        </div>

        <div className="rounded-xl bg-nube p-2.5 border border-piedra-soft text-center">
          <span className="text-[9px] text-piedra uppercase block">NDVI Zonal ({targetYear})</span>
          <span className="font-bold text-bosque text-sm">{metrics.zoneMeanNdvi.toFixed(3)}</span>
        </div>
      </div>

      {/* Dimensiones Biofísicas en Lenguaje Natural */}
      <div className="mt-3 pt-2.5 border-t border-piedra-soft">
        <span className="text-[9px] font-mono font-bold tracking-wider text-piedra uppercase block mb-2">
          Dimensiones Biofísicas Evaluadas:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
          {dimensions.slice(0, 4).map((dim, i) => (
            <div
              key={i}
              className="rounded-xl bg-nube/80 p-2.5 border border-piedra-soft/80"
            >
              <span className="text-[9px] text-piedra uppercase font-bold block mb-0.5">{dim.label}</span>
              <span className="font-bold text-bosque block truncate">{dim.value}</span>
            </div>
          ))}
          <div className="rounded-xl bg-nube/80 p-2.5 border border-piedra-soft/80 sm:col-span-2">
            <span className="text-[9px] text-piedra uppercase font-bold block mb-0.5">{dimensions[4].label}</span>
            <span className="font-bold text-bosque block">{dimensions[4].value}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
