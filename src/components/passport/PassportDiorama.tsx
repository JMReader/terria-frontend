"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Move3d } from "lucide-react";
import { FieldItem } from "@/data/fieldsData";

const FieldTerrainGPU = dynamic(
  () => import("@/components/terrain/FieldTerrainGPU"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-nube text-bosque/60 text-xs font-sans">
        <div className="flex flex-col items-center gap-2">
          <Move3d className="h-6 w-6 animate-pulse text-musgo" />
          <span>Preparando terreno 3D…</span>
        </div>
      </div>
    ),
  }
);

interface PassportDioramaProps {
  field: FieldItem;
}

export default function PassportDiorama({ field }: PassportDioramaProps) {
  const [fallback, setFallback] = useState<string | null>(null);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-3xl border border-piedra-soft bg-papel shadow-sm">
      {fallback ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-nube text-center">
          <Move3d className="h-8 w-8 text-piedra" />
          <p className="text-xs font-mono text-bosque/70">
            Diorama 3D no disponible en este navegador
          </p>
          <p className="text-[10px] font-mono text-piedra">({fallback})</p>
        </div>
      ) : (
        <FieldTerrainGPU
          key={field.id}
          field={field}
          onFallback={(reason) => setFallback(reason)}
          className="h-full w-full"
        />
      )}

      {/* Tira de información — lo único sobre la escena */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-piedra-soft/70 bg-papel/85 px-4 py-2.5 backdrop-blur-sm">
        <span className="truncate text-sm font-semibold text-bosque">{field.name}</span>
        <div className="flex shrink-0 items-center gap-3 text-[11px] font-mono text-bosque/70 tabular-nums">
          <span>{field.hectares} ha</span>
          <span>NDVI {field.ndvi.toFixed(2)}</span>
          {!fallback && <span className="hidden sm:inline text-piedra">arrastrá para orbitar</span>}
        </div>
      </div>
    </div>
  );
}
