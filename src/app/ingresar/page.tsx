import type { Metadata } from "next";
import { Suspense } from "react";
import AuthView from "@/components/auth/AuthView";

export const metadata: Metadata = {
  title: "TERRIA — Ingresar",
  description: "Ingreso de dueños al panel de parcelas TERRIA.",
};

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <Suspense>
      <AuthView next={next ?? null} />
    </Suspense>
  );
}
