'use client';

import { cn } from '@/lib/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/cuentas/movimientos', label: 'Movimientos', icon: '📊' },
  { href: '/cuentas/cola', label: 'Categorizar', icon: '🏷' },
  { href: '/cuentas/recurrentes', label: 'Recurrentes', icon: '🔁' },
  { href: '/cuentas/importar', label: 'Importar', icon: '↑' },
] as const;

export function CuentasSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-card)]/50">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center gap-1 overflow-x-auto h-11">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors',
                active
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
              )}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
