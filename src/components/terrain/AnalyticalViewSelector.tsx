"use client";

/**
 * AnalyticalViewSelector — selector de lente analítica del terreno 3D.
 *
 * Spec diorama T02: cuatro vistas sobre la misma geometría —
 *  ndvi       → rampa agronómica por lote / tile NDVI drappeado
 *  rgb        → captura Sentinel-2 natural drappeada
 *  thermal    → tinte ERA5 por temperatura media del día
 *  moisture   → saturación por lluvia 7d + precipitación procedural
 *  topography → hipsometría + curvas de nivel marcadas
 */

export type TerrainViewMode = "ndvi" | "rgb" | "thermal" | "moisture" | "topography";

const MODES: { id: TerrainViewMode; label: string; title: string }[] = [
  { id: "ndvi", label: "NDVI", title: "Vigor vegetal — Sentinel-2 NDVI" },
  { id: "rgb", label: "Sat", title: "Captura satelital natural" },
  { id: "thermal", label: "Temp", title: "Temperatura media ERA5" },
  { id: "moisture", label: "Agua", title: "Humedad y lluvia acumulada 7d" },
  { id: "topography", label: "Topo", title: "Relieve y curvas de nivel" },
];

export default function AnalyticalViewSelector({
  mode,
  onChange,
}: {
  mode: TerrainViewMode;
  onChange: (m: TerrainViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-piedra-soft/70 bg-papel/85 p-0.5 backdrop-blur-sm">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          title={m.title}
          className={`rounded-full px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            mode === m.id
              ? "bg-bosque text-papel"
              : "text-bosque/60 hover:text-bosque"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
