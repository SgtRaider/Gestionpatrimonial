'use client';

import { cn } from '@/lib/cn';
import { formatDelta, isPositive } from '@/lib/format';
import type { TransactionListItem } from '@gp/shared';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

function statusIcon(t: TransactionListItem): string {
  if (t.transferPairId) return '⇄';
  if (t.recurringRuleId) return '🔁';
  if (t.status === 'pending') return '⏳';
  return '●';
}

export function TransactionsTable({
  items,
  selectedId,
  onSelect,
}: {
  items: TransactionListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--color-muted)] bg-[var(--color-bg)]/50">
          <tr>
            <th className="text-left px-3 py-2 font-medium w-20">Fecha</th>
            <th className="text-left px-3 py-2 font-medium">Cuenta</th>
            <th className="text-left px-3 py-2 font-medium">Contraparte</th>
            <th className="text-left px-3 py-2 font-medium">Categoría</th>
            <th className="text-right px-3 py-2 font-medium w-32">Importe</th>
            <th className="text-center px-3 py-2 font-medium w-10">Est.</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-[var(--color-muted)]">
                No hay movimientos que coincidan con los filtros.
              </td>
            </tr>
          ) : (
            items.map((t) => {
              const isSelected = t.id === selectedId;
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(t.id);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={cn(
                    'border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg)]/40 focus:outline-none focus:bg-[var(--color-accent)]/5',
                    isSelected && 'bg-[var(--color-accent)]/8',
                    t.status === 'pending' && 'border-l-2 border-l-amber-500 border-l-dashed',
                  )}
                >
                  <td className="px-3 py-2 text-[var(--color-muted)] whitespace-nowrap">
                    {formatDate(t.bookedAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: t.institutionColor ?? '#999' }}
                        aria-hidden
                      />
                      <span>{t.institutionName}</span>
                      {t.accountIbanLast4 ? (
                        <span className="text-[var(--color-muted)] text-xs">
                          ✓{t.accountIbanLast4}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium truncate max-w-[260px]">
                      {t.normalizedMerchant ?? t.counterparty ?? t.descriptionRaw}
                    </div>
                    <div className="text-xs text-[var(--color-muted)] truncate max-w-[260px]">
                      {t.descriptionRaw}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {t.category ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
                        style={{
                          background: `${t.category.color ?? '#999'}20`,
                          color: t.category.color ?? '#999',
                        }}
                      >
                        {t.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)] italic">
                        Sin categorizar
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium',
                      isPositive(t.amount)
                        ? 'text-[var(--color-positive)]'
                        : 'text-[var(--color-fg)]',
                    )}
                  >
                    {formatDelta(t.amount)}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">{statusIcon(t)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
