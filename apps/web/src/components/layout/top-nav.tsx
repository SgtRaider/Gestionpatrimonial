'use client';

import { cn } from '@/lib/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Section = {
  href: string;
  label: string;
  icon: string;
  match?: string;
};

const SECTIONS: readonly Section[] = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/patrimonio', label: 'Patrimonio', icon: '💰' },
  { href: '/cuentas/movimientos', label: 'Cuentas', icon: '💳', match: '/cuentas' },
  { href: '/deudas', label: 'Deudas', icon: '🏦' },
  { href: '/planificacion', label: 'Planificación', icon: '📅' },
  { href: '/optimizacion', label: 'Optimización', icon: '💡' },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-card)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-card)]/60">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold whitespace-nowrap">
          Gestión <span className="text-[var(--color-accent)]">Patrimonial</span>
        </Link>

        <nav className="flex-1 flex items-center gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const active = pathname === s.href || pathname.startsWith(s.match ?? s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  'px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
                )}
              >
                <span className="mr-1.5">{s.icon}</span>
                {s.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/configuracion"
          aria-label="Configuración"
          className={cn(
            'px-2 py-1.5 rounded text-sm transition-colors',
            pathname.startsWith('/configuracion')
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
          )}
        >
          ⚙️
        </Link>
      </div>
    </header>
  );
}
