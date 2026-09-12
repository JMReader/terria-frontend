"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, ShieldCheck, MapPin } from "lucide-react";
import { FieldItem } from "@/data/fieldsData";

gsap.registerPlugin(useGSAP);

export interface FieldDetailViewProps {
  field: FieldItem;
  onBack: () => void;
  onExpandData?: () => void;
}

const DefRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-2 border-b border-piedra-soft/70 last:border-0">
    <dt className="text-[11px] font-mono uppercase tracking-wider text-piedra shrink-0">{label}</dt>
    <dd className="text-sm font-semibold text-bosque text-right tabular-nums">{children}</dd>
  </div>
);

export default function FieldDetailView({
  field,
  onBack,
  onExpandData,
}: FieldDetailViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // WhatsApp click to chat setup
  const rawPhone = field.ownerPhone || "+5493516884210";
  const cleanPhone = rawPhone.replace(/[^\d]/g, "");
  const formattedPhone = rawPhone.startsWith("+")
    ? rawPhone
    : `+${rawPhone.slice(0, 2)} ${rawPhone.slice(2, 3)} ${rawPhone.slice(3, 6)} ${rawPhone.slice(6)}`;

  const whatsappMessage = encodeURIComponent(
    `Hola, me interesa consultar por el lote "${field.name}" (${field.hectares} ha en ${
      field.locality || field.province || "Argentina"
    }) que vi en TERRIA. ¿Podrías brindarme más información?`
  );
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${whatsappMessage}`;

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-piedra-soft bg-papel shadow-sm select-none"
    >
      {/* Header plano: navegación + nombre + badge */}
      <div className="shrink-0 border-b border-piedra-soft p-4 sm:p-5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleBackClick}
            className="inline-flex items-center gap-1 text-xs font-mono font-bold text-bosque/70 hover:text-bosque transition-colors cursor-pointer"
          >
            ‹ Catálogo de lotes
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-musgo/10 border border-musgo/25 px-2.5 py-0.5 text-[10px] font-mono font-bold text-musgo uppercase tracking-wider">
            <ShieldCheck className="h-3 w-3" />
            Verificado
          </span>
        </div>

        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-musgo">
            {field.code || "PARCELA CERTIFICADA"}
          </span>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-bosque leading-snug">
            {field.name}
          </h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono text-piedra">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-musgo" />
            <span>
              {field.locality || "Argentina"}
              {field.province ? `, ${field.province}` : ""}
              {field.coordinates ? ` · ${field.coordinates}` : ""}
            </span>
          </p>
        </div>
      </div>

      {/* Cuerpo: Resumen del Lote */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
        <div ref={contentRef} className="space-y-4">
          <div className="rounded-2xl border border-piedra-soft/80 bg-nube/40 p-3.5">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-piedra mb-2">
              Ficha Técnica del Campo
            </p>
            <dl>
              <DefRow label="Superficie">{field.hectares} ha</DefRow>
              <DefRow label="Cultivo">{field.primaryCrop || field.crop || "—"}</DefRow>
              <DefRow label="Aptitud">
                {field.suitabilityScore != null ? `${field.suitabilityScore}% · ` : ""}
                {field.aptitude || "Clase I-II"}
              </DefRow>
              <DefRow label="Vigor NDVI">
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
              <DefRow label="Napa freática">{field.waterTable || "Cota normal"}</DefRow>
              <DefRow label="Régimen">{field.irrigation ? "Riego pivote" : "Secano"}</DefRow>
              <DefRow label="Rinde histórico ref.">
                {field.rentQqSoja != null ? `${field.rentQqSoja} qq/ha` : "N/D"}
              </DefRow>
            </dl>
          </div>

          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-piedra mb-1.5">
              Campañas Agrícolas
            </p>
            <div className="text-xs font-mono rounded-2xl border border-piedra-soft/60 bg-white/50 px-3.5 py-1">
              <div className="flex items-center justify-between py-2 border-b border-piedra-soft/60">
                <span className="text-bosque/75">2024/25 · Maíz Tardío</span>
                <span className="font-bold text-musgo tabular-nums">98 qq/ha</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-piedra-soft/60">
                <span className="text-bosque/75">2023/24 · Soja 1ra</span>
                <span className="font-bold text-bosque tabular-nums">41 qq/ha</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-bosque/75">2022/23 · Trigo / Soja</span>
                <span className="font-bold text-bosque tabular-nums">44 qq/ha</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Botón de WhatsApp "Contactame" + botón ampliado */}
      <div className="shrink-0 border-t border-piedra-soft p-4 sm:p-5 bg-papel space-y-2.5">
        {/* Botón WhatsApp directo */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-3 w-full rounded-2xl bg-[#1f7a46] hover:bg-[#186338] text-white px-4 py-3 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white group-hover:scale-105 transition-transform">
              <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-bold font-sans tracking-wide leading-none">
                Contactame
              </div>
              <div className="text-[10px] font-mono text-white/85 truncate mt-0.5">
                {field.ownerName ? `${field.ownerName} · ` : ""}
                {formattedPhone}
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-white/80 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
        </a>

        {/* Botón de datos ampliados */}
        {onExpandData && (
          <button
            onClick={onExpandData}
            className="flex w-full items-center justify-between text-xs font-mono font-semibold text-bosque/70 hover:text-bosque transition-colors py-1 px-1 cursor-pointer"
          >
            <span>Ver datos adicionales del lote</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
