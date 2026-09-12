import type { Metadata } from "next";
import ParcelPassportLoader from "@/components/passport/ParcelPassportLoader";
import { API_BASE } from "@/lib/terriaApi";

interface PublicFieldSummary {
  name: string;
  area_hectares: number;
  locality: string | null;
  province: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let field: PublicFieldSummary | null = null;
  try {
    const res = await fetch(`${API_BASE}/v1/public/fields/${slug}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) field = (await res.json()) as PublicFieldSummary;
  } catch {
    /* backend offline — metadata genérica */
  }

  const title = field
    ? `TERRIA — Pasaporte de ${field.name}`
    : "TERRIA — Pasaporte digital de parcela";
  const description = field
    ? `Gemelo digital verificado: ${Math.round(field.area_hectares)} ha en ${field.locality ?? "Argentina"}${field.province ? `, ${field.province}` : ""}. Diorama 3D, timelapse satelital, futurología de valor y certificado blockchain.`
    : "Vista pública verificable de una parcela TERRIA.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "TERRIA",
    },
  };
}

export default async function PublicParcelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ParcelPassportLoader slug={slug} mode="public" />;
}
