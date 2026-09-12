"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FIELDS_DATA, FieldItem } from "@/data/fieldsData";
import FloatingIslandHeader from "@/components/FloatingIslandHeader";
import FieldCardsList from "@/components/FieldCardsList";
import FieldDetailView from "@/components/FieldDetailView";
import Hero from "@/components/landing/Hero";
import SiteFooter from "@/components/landing/SiteFooter";
import { useFieldTimelapse } from "@/hooks/useFieldTimelapse";
import { DEMO_TIMELAPSE_MANIFEST } from "@/data/timelapseMockData";
import { Satellite, Move3d } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TimelapseManifest } from "@/types/terria";
import { normalizeTimelapseManifest } from "@/lib/timelapseNormalizer";
import { adaptBackendField, ApiFieldResponse } from "@/lib/terriaApi";
import { useOwnerAuth } from "@/components/auth/OwnerAuthProvider";

gsap.registerPlugin(useGSAP);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Dynamic imports — WebGL/WebGPU canvases can't SSR
const Planet3D = dynamic(() => import("@/components/Planet3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-nube text-bosque/60 text-xs font-sans">
      <div className="flex flex-col items-center gap-2">
        <Satellite className="h-6 w-6 animate-spin text-musgo" />
        <span>Cargando mapa de relieve...</span>
      </div>
    </div>
  ),
});

const FieldTerrainGPU = dynamic(
  () => import("@/components/terrain/FieldTerrainGPU"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-nube text-bosque/60 text-xs font-sans">
        <div className="flex flex-col items-center gap-2">
          <Move3d className="h-6 w-6 animate-pulse text-musgo" />
          <span>Preparando terreno 3D...</span>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  const [selectedField, setSelectedField] = useState<FieldItem>(FIELDS_DATA[0]);
  const [isFieldExpanded, setIsFieldExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [backendFields, setBackendFields] = useState<FieldItem[]>(FIELDS_DATA);
  const [timelapseManifest, setTimelapseManifest] = useState<TimelapseManifest>(DEMO_TIMELAPSE_MANIFEST);
  const [terrainFallback, setTerrainFallback] = useState<string | null>(null);
  const [terrainReveal, setTerrainReveal] = useState(false);

  // Fetch fields and timelapse data from real backend on mount
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const health = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
        if (!health.ok) throw new Error("backend offline");

        const fieldsRes = await fetch(`${API_URL}/v1/fields`);
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json();
          if (Array.isArray(fieldsData) && fieldsData.length > 0) {
            const mapped: FieldItem[] = fieldsData.map((f: ApiFieldResponse, idx: number) =>
              adaptBackendField(f, idx)
            );
            // Solo los campos que existen en la BD — sin mezclar el catálogo mock
            setBackendFields(mapped);
            setSelectedField((prev) =>
              mapped.some((f) => f.id === prev.id) ? prev : mapped[0]
            );

            const firstFieldId = mapped[0].id;
            const tlRes = await fetch(`${API_URL}/v1/fields/${firstFieldId}/timelapses`);
            if (tlRes.ok) {
              const datasets = await tlRes.json();
              const readyDataset = datasets.find(
                (d: { status: string }) => d.status === "ready" || d.status === "partial"
              );
              if (readyDataset) {
                const manifestRes = await fetch(
                  `${API_URL}/v1/fields/${firstFieldId}/timelapses/${readyDataset.id}`
                );
                if (manifestRes.ok) {
                  const raw = await manifestRes.json();
                  setTimelapseManifest(normalizeTimelapseManifest(raw));
                }
              }
            }
          }
        }
      } catch {
        console.info("[TERRIA] Backend not reachable — using demo mock data");
      }
    };

    fetchBackendData();
  }, []);

  // Synchronized timelapse engine shared by map parcels + detail panel
  const timelapse = useFieldTimelapse({ manifest: timelapseManifest });
  const router = useRouter();
  const { owner } = useOwnerAuth();

  // El pasaporte completo vive en su ruta: público si está compartido, dueño si no.
  const handleOpenPassport = (field: FieldItem) => {
    if (field.publicSlug) {
      router.push(`/p/${field.publicSlug}`);
      return;
    }
    const passportPath = `/parcela/${field.id}`;
    router.push(owner ? passportPath : `/ingresar?next=${encodeURIComponent(passportPath)}`);
  };

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const cardsPanelRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(mapViewportRef.current, {
        scale: 0.97,
        autoAlpha: 0,
        duration: 0.6,
      }).from(
        cardsPanelRef.current,
        { x: 25, autoAlpha: 0, duration: 0.6 },
        "-=0.4"
      );
    },
    { scope: pageContainerRef }
  );

  const handleSelectField = async (field: FieldItem) => {
    setSelectedField(field);
    setIsFieldExpanded(true);
    setTerrainFallback(null);
    // Si ya estábamos expandidos el mapa está tapado por la escena → reveal inmediato.
    // Si venimos del catálogo, el terreno aparece cuando el flyTo cinematográfico aterriza.
    setTerrainReveal(isFieldExpanded);

    if (mapViewportRef.current) {
      gsap.fromTo(
        mapViewportRef.current,
        { scale: 0.988 },
        { scale: 1, duration: 0.4, ease: "power2.out" }
      );
    }

    try {
      const tlRes = await fetch(`${API_URL}/v1/fields/${field.id}/timelapses`);
      if (tlRes.ok) {
        const datasets = await tlRes.json();
        const readyDataset = datasets.find(
          (d: { status: string }) => d.status === "ready" || d.status === "partial"
        );
        if (readyDataset) {
          const manifestRes = await fetch(
            `${API_URL}/v1/fields/${field.id}/timelapses/${readyDataset.id}`
          );
          if (manifestRes.ok) {
            const raw = await manifestRes.json();
            setTimelapseManifest(normalizeTimelapseManifest(raw));
          }
        }
      }
    } catch {
      // Backend not responding for this field — keep active manifest
    }
  };

  const handleBackToCatalog = () => {
    setIsFieldExpanded(false);
    setTerrainReveal(false);
    if (mapViewportRef.current) {
      gsap.fromTo(
        mapViewportRef.current,
        { scale: 0.99 },
        { scale: 1, duration: 0.35, ease: "power2.out" }
      );
    }
  };

  return (
    <div
      ref={pageContainerRef}
      className="relative min-h-screen w-full bg-nube text-bosque select-none"
    >
      {/* ── LANDING: hero de marca ─────────────────────────────── */}
      <Hero />

      {/* ── EXPLORADOR: mapa de relieve + terreno 3D ───────────── */}
      <section
        id="explorador"
        className="relative flex h-screen max-h-screen flex-col overflow-hidden"
      >
        <div className="relative z-50 shrink-0 px-4 sm:px-6 pt-3 pb-2">
          <FloatingIslandHeader onSearchChange={setSearchQuery} />
        </div>

        <div className="relative z-10 flex items-baseline justify-between px-4 pb-2 sm:px-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-musgo">
            Explorador territorial
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-piedra">
            {backendFields.length} parcelas en cartera
          </span>
        </div>

        <main className="relative z-10 flex-1 min-h-0 w-full grid grid-cols-1 grid-rows-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-1 lg:grid-cols-12 gap-4 px-4 sm:px-6 pb-3 overflow-hidden">
          {/* LEFT: mapa de relieve — al seleccionar se transforma en terreno 3D */}
          <div
            ref={mapViewportRef}
            className="lg:col-span-7 xl:col-span-8 h-full min-h-0 flex flex-col relative rounded-3xl border border-piedra-soft bg-papel shadow-sm overflow-hidden"
          >
            <div className="relative flex-1 w-full h-full min-h-0">
              <Planet3D
                embedded={true}
                selectedField={selectedField}
                fields={backendFields}
                isExpanded={isFieldExpanded}
                onSelectField={handleSelectField}
                onDiveEnd={() => setTerrainReveal(true)}
                timelapse={timelapse}
                className="h-full w-full"
              />

              {/* Terreno 3D real — WebGPU sobre DEM; aparece al aterrizar el flyTo */}
              {isFieldExpanded && terrainReveal && !terrainFallback && (
                <div className="absolute inset-0 z-20 animate-in fade-in duration-300">
                  <FieldTerrainGPU
                    key={selectedField.id}
                    field={selectedField}
                    timelapse={timelapse}
                    onFallback={() => setTerrainFallback("gpu")}
                    className="h-full w-full"
                  />
                </div>
              )}

              {/* Tira de información — lo único sobre la escena */}
              {isFieldExpanded && (
                <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-piedra-soft/70 bg-papel/85 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={handleBackToCatalog}
                      className="shrink-0 text-xs font-mono font-bold text-bosque/70 hover:text-bosque transition-colors cursor-pointer"
                    >
                      ‹ Mapa
                    </button>
                    <span className="truncate text-sm font-semibold text-bosque">
                      {selectedField.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[11px] font-mono text-bosque/70 tabular-nums">
                    <span>{selectedField.hectares} ha</span>
                    <span>NDVI {selectedField.ndvi.toFixed(2)}</span>
                    <span className="hidden sm:inline text-piedra">
                      {terrainFallback ? "relieve inclinado" : "arrastrá para orbitar"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: lista de campos o detalle */}
          <div
            ref={cardsPanelRef}
            className="lg:col-span-5 xl:col-span-4 h-full min-h-0 flex flex-col overflow-hidden"
          >
            {isFieldExpanded ? (
              <FieldDetailView
                field={selectedField}
                onBack={handleBackToCatalog}
                onOpenPassport={() => handleOpenPassport(selectedField)}
              />
            ) : (
              <FieldCardsList
                selectedField={selectedField}
                onSelectField={handleSelectField}
                filterQuery={searchQuery}
                fields={backendFields}
                className="h-full min-h-0"
              />
            )}
          </div>
        </main>
      </section>

      <SiteFooter />
    </div>
  );
}
