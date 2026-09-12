import type { Metadata } from "next";
import { Suspense } from "react";
import OwnerGate from "@/components/auth/OwnerGate";
import ParcelPassportLoader from "@/components/passport/ParcelPassportLoader";

export const metadata: Metadata = {
  title: "TERRIA — Pasaporte de parcela",
};

export default async function ParcelaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <OwnerGate>
        <ParcelPassportLoader id={id} mode="owner" />
      </OwnerGate>
    </Suspense>
  );
}
