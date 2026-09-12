"use client";

import React from "react";
import { FieldItem } from "@/data/fieldsData";
import { ChevronRight } from "lucide-react";

interface FieldCardProps {
  field: FieldItem;
  isSelected: boolean;
  onSelect: (field: FieldItem) => void;
}

const ndviDot = (v: number) =>
  v > 0.6 ? "#4a6b46" : v > 0.4 ? "#8a9a6b" : "#c9b28a";

export default function FieldCard({ field, isSelected, onSelect }: FieldCardProps) {
  return (
    <button
      onClick={() => onSelect(field)}
      className={`field-card-item group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors select-none cursor-pointer ${
        isSelected ? "bg-musgo/10" : "hover:bg-nube/70"
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: ndviDot(field.ndvi) }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-bosque">
          {field.name}
        </span>
        <span className="block truncate text-[11px] text-piedra">
          {field.locality || "Argentina"} · {field.primaryCrop || field.crop || "Campo"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-bosque tabular-nums">
          {field.hectares} ha
        </span>
        <span className="block text-[10px] font-mono text-piedra tabular-nums">
          NDVI {field.ndvi.toFixed(2)}
        </span>
      </span>
      <ChevronRight
        className={`h-4 w-4 shrink-0 transition-all ${
          isSelected ? "text-musgo" : "text-piedra/50 group-hover:text-bosque group-hover:translate-x-0.5"
        }`}
      />
    </button>
  );
}
