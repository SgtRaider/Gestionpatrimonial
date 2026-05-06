import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-semibold mb-2">Gestión Patrimonial</h1>
        <p className="text-[var(--color-muted)]">Planificador financiero personal</p>
      </div>
      <nav className="flex gap-4">
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white"
        >
          Ir al Dashboard
        </Link>
      </nav>
      <p className="text-xs text-[var(--color-muted)]">
        Estado: scaffold inicial · v0.0.0
      </p>
    </main>
  );
}
