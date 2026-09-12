import Link from "next/link";

export default function PublicParcelNotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-nube px-4 text-center">
      <p className="font-display text-2xl text-bosque">Pasaporte no disponible</p>
      <p className="max-w-sm text-xs font-mono text-piedra">
        El link pudo haber sido revocado por el dueño o no existe.
      </p>
      <Link
        href="/"
        className="mt-2 text-xs font-mono font-bold uppercase tracking-wider text-musgo hover:underline"
      >
        ‹ Volver al explorador
      </Link>
    </div>
  );
}
