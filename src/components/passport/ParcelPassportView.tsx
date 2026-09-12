"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Satellite, ShieldCheck, Shuffle, TrendingUp } from "lucide-react";
import { FieldItem } from "@/data/fieldsData";
import {
  PassportMode,
  PassportSource,
  ShareState,
} from "@/types/passport";
import { TimelapseManifest } from "@/types/terria";
import { API_BASE } from "@/lib/terriaApi";
import { normalizeTimelapseManifest } from "@/lib/timelapseNormalizer";
import { DEMO_TIMELAPSE_MANIFEST, DEMO_SOLANA_CERTIFICATION } from "@/data/timelapseMockData";
import { useFieldTimelapse } from "@/hooks/useFieldTimelapse";
import PassportDiorama from "@/components/passport/PassportDiorama";
import PassportTimelapse from "@/components/passport/PassportTimelapse";
import SharePanel from "@/components/passport/SharePanel";
import CertificatePdfCard from "@/components/passport/CertificatePdfCard";
import SolanaAuditCard from "@/components/certification/SolanaAuditCard";
import ValuationPanel from "@/components/valuation/ValuationPanel";
import WhatIfPanel from "@/components/what_if/WhatIfPanel";

export interface ParcelPassportViewProps {
  field: FieldItem;
  mode: PassportMode;
  source: PassportSource;
  shareState: ShareState;
  onCopyLink?: () => Promise<string | null>;
  onUnshare?: () => Promise<void>;
}

const TABS = [
  { id: "datos", label: "Datos", icon: Satellite },
  { id: "futurologia", label: "Futurología", icon: TrendingUp },
  { id: "whatif", label: "What-if", icon: Shuffle },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Pasaporte digital de parcela — layout dashboard:
 * izquierda la identidad + diorama 3D dominante; derecha un panel limpio con
 * segmented control (Datos / Futurología / What-if) y el certificado blockchain
 * anclado abajo. El certificado Solana vive dentro de "Datos" como auditoría
 * on-chain de la serie observada.
 */
export default function ParcelPassportView({
  field,
  mode,
  source,
  shareState,
  onCopyLink,
  onUnshare,
}: ParcelPassportViewProps) {
  const [manifest, setManifest] = useState<TimelapseManifest>(DEMO_TIMELAPSE_MANIFEST);
  const [tab, setTab] = useState<TabId>("datos");
  // Cada pestaña se monta la primera vez que se visita y luego queda viva
  // (hidden) — preserva el estado de formularios y evita re-fetches.
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set(["datos"]));

  const selectTab = (id: TabId) => {
    setTab(id);
    setVisited((v) => (v.has(id) ? v : new Set(v).add(id)));
  };

  // Manifest del timelapse por parcela — mismo flujo que el explorador
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tlRes = await fetch(`${API_BASE}/v1/fields/${field.id}/timelapses`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!tlRes.ok) return;
        const datasets = await tlRes.json();
        const ready = datasets.find(
          (d: { status: string }) => d.status === "ready" || d.status === "partial"
        );
        if (!ready) return;
        const manifestRes = await fetch(
          `${API_BASE}/v1/fields/${field.id}/timelapses/${ready.id}`
        );
        if (!manifestRes.ok) return;
        const raw = await manifestRes.json();
        if (!cancelled) setManifest(normalizeTimelapseManifest(raw));
      } catch {
        /* backend offline — queda el manifest demo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [field.id]);

  const timelapse = useFieldTimelapse({ manifest });
  const publicUrl =
    shareState.isPublished && shareState.publicSlug
      ? typeof window !== "undefined"
        ? `${window.location.origin}/p/${shareState.publicSlug}`
        : `/p/${shareState.publicSlug}`
      : null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-nube text-bosque select-none lg:h-screen lg:overflow-hidden">
      {/* ── Cabecera ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-piedra-soft/70 bg-nube/85 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={mode === "owner" ? "/mis-parcelas" : "/"}
              className="shrink-0 text-xs font-mono font-bold text-bosque/70 transition-colors hover:text-bosque"
            >
              ‹ {mode === "owner" ? "Mis parcelas" : "Explorador"}
            </Link>
            <span className="hidden sm:inline text-piedra">·</span>
            <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-musgo">
              Pasaporte digital
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {source === "demo" && (
              <span className="rounded-full border border-piedra-soft bg-papel px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-piedra">
                demo
              </span>
            )}
            {mode === "owner" && onCopyLink && onUnshare && (
              <SharePanel shareState={shareState} onCopyLink={onCopyLink} onUnshare={onUnshare} />
            )}
          </div>
        </div>
      </header>

      {/* ── Dashboard: diorama | panel de features ───────────── */}
      <main className="grid flex-1 grid-cols-1 gap-4 px-4 pb-4 pt-4 sm:px-6 lg:min-h-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* IZQUIERDA: identidad + diorama 3D dominante */}
        <div className="flex min-h-0 flex-col gap-4">
          <section className="shrink-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-bosque">
                {field.name}
              </h1>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-musgo/10 border border-musgo/25 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-musgo">
                <ShieldCheck className="h-3 w-3" />
                Verificado
              </span>
            </div>
            <p className="mt-1.5 text-xs font-mono text-piedra tabular-nums">
              {field.locality || "Argentina"}
              {field.province ? `, ${field.province}` : ""}
              {field.coordinates ? ` · ${field.coordinates}` : ""} · {field.hectares} ha
            </p>
            {field.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bosque/75 line-clamp-2">
                {field.description}
              </p>
            )}
          </section>

          <div className="min-h-[420px] flex-1 lg:min-h-0">
            <PassportDiorama field={field} />
          </div>
        </div>

        {/* DERECHA: panel con segmented control + certificado */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-piedra-soft bg-papel shadow-sm">
          {/* Segmented control — estilo iOS, tokens Terria */}
          <div className="shrink-0 border-b border-piedra-soft/70 p-3">
            <div
              role="tablist"
              aria-label="Features del pasaporte"
              className="grid grid-cols-3 gap-1 rounded-full border border-piedra-soft bg-nube p-1"
            >
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`passport-panel-${id}`}
                    onClick={() => selectTab(id)}
                    className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      active
                        ? "bg-bosque text-nube shadow-xs"
                        : "text-piedra hover:text-bosque"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenido de la pestaña — scroll interno */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar lg:min-h-0">
            {visited.has("datos") && (
              <div
                role="tabpanel"
                id="passport-panel-datos"
                aria-label="Datos"
                className={`space-y-4 ${tab === "datos" ? "" : "hidden"}`}
              >
                <PassportTimelapse field={field} timelapse={timelapse} />
                <SolanaAuditCard certification={DEMO_SOLANA_CERTIFICATION} />
              </div>
            )}
            {visited.has("futurologia") && (
              <div
                role="tabpanel"
                id="passport-panel-futurologia"
                aria-label="Futurología"
                className={tab === "futurologia" ? "" : "hidden"}
              >
                <ValuationPanel field={field} />
              </div>
            )}
            {visited.has("whatif") && (
              <div
                role="tabpanel"
                id="passport-panel-whatif"
                aria-label="What-if"
                className={tab === "whatif" ? "" : "hidden"}
              >
                <WhatIfPanel field={field} />
              </div>
            )}
          </div>

          {/* Certificado blockchain — anclado abajo, siempre visible */}
          <div className="shrink-0 border-t border-piedra-soft/70 bg-nube/60 px-4 py-3">
            <CertificatePdfCard
              field={field}
              publicUrl={publicUrl}
              className="border-0 bg-transparent p-0"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
