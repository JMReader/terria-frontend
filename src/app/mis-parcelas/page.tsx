import type { Metadata } from "next";
import { Suspense } from "react";
import OwnerGate from "@/components/auth/OwnerGate";
import MisParcelasView from "@/components/owner/MisParcelasView";

export const metadata: Metadata = {
  title: "TERRIA — Mis parcelas",
  description: "Panel del dueño: parcelas cargadas y compartición de pasaportes digitales.",
};

export default function MisParcelasPage() {
  return (
    <Suspense>
      <OwnerGate>
        <MisParcelasView />
      </OwnerGate>
    </Suspense>
  );
}
