"use client";

import React, { useEffect, useRef } from "react";
import { FieldItem } from "@/data/fieldsData";
import FieldCard from "./FieldCard";
import { Filter, Loader2, Unplug } from "lucide-react";
import gsap from "gsap";

interface FieldCardsListProps {
  selectedField: FieldItem | null;
  onSelectField: (field: FieldItem) => void;
  filterQuery?: string;
  className?: string;
  /** Parcelas del backend — sin fallback a datos locales */
  fields?: FieldItem[];
  /** Estado de la conexión con el backend (para el mensaje de lista vacía) */
  backendStatus?: "loading" | "live" | "error";
}

export default function FieldCardsList({
  selectedField,
  onSelectField,
  filterQuery = "",
  className = "",
  fields,
  backendStatus = "live",
}: FieldCardsListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const filteredFields = React.useMemo(() => {
    const sourceData = fields ?? [];
    if (!filterQuery.trim()) return sourceData;
    const q = filterQuery.toLowerCase();
    return sourceData.filter((field) => {
      const matchesName = field.name.toLowerCase().includes(q);
      const matchesLoc =
        (field.locality ?? "").toLowerCase().includes(q) ||
        (field.province ?? "").toLowerCase().includes(q);
      const matchesCrop = (field.primaryCrop ?? field.crop ?? "").toLowerCase().includes(q);
      const matchesSoil = (field.soilSeries ?? field.soilType ?? "").toLowerCase().includes(q);
      const matchesTags = (field.tags ?? []).some((t: string) => t.toLowerCase().includes(q));
      return matchesName || matchesLoc || matchesCrop || matchesSoil || matchesTags;
    });
  }, [filterQuery, fields]);

  useEffect(() => {
    if (listRef.current) {
      const cards = listRef.current.querySelectorAll(".field-card-item");
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.35, ease: "power2.out" }
        );
      }
    }
  }, [filteredFields]);

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-3xl border border-piedra-soft bg-papel shadow-sm ${className}`}
    >
      <div
        ref={listRef}
        className="flex-1 min-h-0 divide-y divide-piedra-soft/70 overflow-y-auto py-1 custom-scrollbar"
      >
        {filteredFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-piedra space-y-2 px-6">
            {backendStatus === "loading" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-piedra-soft" />
                <p className="text-xs text-bosque/60">Cargando parcelas…</p>
              </>
            ) : backendStatus === "error" ? (
              <>
                <Unplug className="h-8 w-8 text-piedra-soft" />
                <p className="text-xs text-bosque/60">
                  Sin conexión con el backend — no hay datos de parcelas para mostrar.
                </p>
              </>
            ) : (
              <>
                <Filter className="h-8 w-8 text-piedra-soft" />
                <p className="text-xs text-bosque/60">
                  No se encontraron campos para la búsqueda.
                </p>
              </>
            )}
          </div>
        ) : (
          filteredFields.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              isSelected={selectedField?.id === field.id}
              onSelect={onSelectField}
            />
          ))
        )}
      </div>
    </div>
  );
}
