import Link from "next/link";

export default function ParcelaNotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-nube px-4 text-center">
      <p className="font-display text-2xl text-bosque">Parcela no encontrada</p>
      <Link
        href="/mis-parcelas"
        className="mt-2 text-xs font-mono font-bold uppercase tracking-wider text-musgo hover:underline"
      >
        ‹ Ir a mis parcelas
      </Link>
    </div>
  );
}
