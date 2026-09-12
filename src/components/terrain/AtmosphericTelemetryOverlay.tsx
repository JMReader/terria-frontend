"use client";

/**
 * AtmosphericTelemetryOverlay — telemetría ERA5 flotante del spec diorama (T04).
 *
 * Tira fina sobre el espacio aéreo del diorama: fecha seleccionada, T° min/max,
 * lluvia del día y acumulada 7d, nubosidad de la captura y NDVI observado.
 * Todo se sincroniza con `timelineState` — cambia con el slider y el playback.
 */

import type { TimelineState } from "@/types/terria";

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

export default function AtmosphericTelemetryOverlay({
  timelineState,
  className = "",
}: {
  timelineState: TimelineState;
  className?: string;
}) {
  const w = timelineState.weather;
  const sat = timelineState.satellite;
  const tMax = w?.temperatureMax?.value;
  const tMin = w?.temperatureMin?.value;
  const rain = w?.precipitationDay?.value;
  const rain7 = w?.precipitation7d?.value;
  const cloud = sat?.quality?.cloudFraction;
  const ndvi = sat?.ndvi?.mean?.value;

  return (
    <div
      className={`pointer-events-none flex items-center gap-2.5 rounded-full border border-piedra-soft/70 bg-papel/85 px-3 py-1.5 font-mono text-[10px] tabular-nums text-bosque/80 backdrop-blur-sm ${className}`}
    >
      <span className="font-bold text-bosque">{fmtDate(timelineState.selectedDate)}</span>
      {tMax != null && (
        <span title="T° máx/mín ERA5">
          {Math.round(tMin ?? tMax)}°/{Math.round(tMax)}°
        </span>
      )}
      {rain != null && (
        <span title="Precipitación del día" className={rain > 0 ? "text-[#2e5d80]" : ""}>
          {rain > 0 ? `☂ ${rain.toFixed(1)}mm` : "0mm"}
        </span>
      )}
      {rain7 != null && rain7 > 0 && (
        <span title="Acumulado 7 días" className="text-bosque/60">
          Σ7d {rain7.toFixed(0)}mm
        </span>
      )}
      {cloud != null && cloud > 0.05 && (
        <span title="Cobertura de nube en la captura" className="text-bosque/60">
          ☁ {Math.round(cloud * 100)}%
        </span>
      )}
      {ndvi != null && (
        <span title="NDVI medio observado" className="font-bold text-musgo">
          NDVI {ndvi.toFixed(2)}
        </span>
      )}
      {!sat && (
        <span className="text-piedra" title={timelineState.missingReason}>
          sin captura
        </span>
      )}
    </div>
  );
}
