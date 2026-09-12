"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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
import SectionHeading from "@/components/brand/SectionHeading";
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

export default function ParcelPassportView({
  field,
  mode,
  source,
  shareState,
  onCopyLink,
  onUnshare,
}: ParcelPassportViewProps) {
  const [manifest, setManifest] = useState<TimelapseManifest>(DEMO_TIMELAPSE_MANIFEST);

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
    <div className="min-h-screen w-full bg-nube text-bosque select-none">
      {/* ── Cabecera de identidad ─────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-piedra-soft/70 bg-nube/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
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

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-8 sm:px-6">
        {/* ── 1. Identidad & verificación ─────────────────────── */}
        <section id="identidad" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-bosque">
                  {field.name}
                </h1>
                <span className="mt-1 flex shrink-0 items-center gap-1 rounded-full bg-musgo/10 border border-musgo/25 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-musgo">
                  <ShieldCheck className="h-3 w-3" />
                  Verificado
                </span>
              </div>
              <p className="mt-1 text-xs font-mono text-piedra">
                {field.locality || "Argentina"}
                {field.province ? `, ${field.province}` : ""}
                {field.coordinates ? ` · ${field.coordinates}` : ""} · {field.hectares} ha
              </p>
              {field.description && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bosque/75">
                  {field.description}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── 2. Diorama 3D ─────────────────────────────────── */}
        <section id="diorama" className="space-y-4">
          <SectionHeading
            kicker="Diorama 3D"
            title="Terreno real del campo"
            description="Maqueta orbitable construida con elevación satelital (DEM) acelerada por WebGPU."
          />
          <PassportDiorama field={field} />
        </section>

        {/* ── 3. Timelapse satelital ────────────────────────── */}
        <section id="timelapse" className="space-y-4">
          <SectionHeading
            kicker="Timelapse satelital"
            title="La historia viva del lote"
            description="Serie temporal NDVI y clima diario — la evidencia del comportamiento real de la parcela."
          />
          <PassportTimelapse field={field} timelapse={timelapse} />
        </section>

        {/* ── 4. Futurología de valor ───────────────────────── */}
        <section id="futurologia" className="space-y-4">
          <SectionHeading
            kicker="Futurología de valor"
            title="Cuánto puede valer esta tierra"
            description="Proyección de valor a N años con drivers auditables: logística, tendencia agronómica y mercado."
          />
          <ValuationPanel field={field} />
        </section>

        {/* ── 5. Simulador What-If ──────────────────────────── */}
        <section id="what-if" className="space-y-4">
          <SectionHeading
            kicker="Simulador What-If"
            title="¿Y si se sembrara otra cosa?"
            description="Ranking contrafáctico de cultivos alternativos con margen neto proyectado y lotes gemelos."
          />
          <WhatIfPanel field={field} />
        </section>

        {/* ── 6. Certificado blockchain ─────────────────────── */}
        <section id="certificado" className="space-y-4 pb-10">
          <SectionHeading
            kicker="Certificado blockchain"
            title="Evidencia sellada on-chain"
            description="Hash de contenido y auditoría en Solana. El PDF certificado acompaña a este pasaporte."
          />
          <div className="space-y-4">
            <CertificatePdfCard field={field} publicUrl={publicUrl} />
            <SolanaAuditCard certification={DEMO_SOLANA_CERTIFICATION} />
          </div>
        </section>
      </main>

      <footer className="border-t border-piedra-soft/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-musgo">
            TERRIA — pasaporte digital de parcela
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-piedra">
            {mode === "public" ? "vista pública de solo lectura" : "vista del dueño"}
          </span>
        </div>
      </footer>
    </div>
  );
}
