'use client';

import { cn } from '@/lib/cn';
import { formatDelta, isPositive } from '@/lib/format';
import type { Category, TransactionListItem } from '@gp/shared';
import { useMemo } from 'react';
import { CategoryCell } from './category-cell';

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
  categories,
  selectedId,
  selectedIds,
  onSelect,
  onCategoryChange,
  onToggleSelected,
  onRangeSelect,
  onToggleAllVisible,
}: {
  items: TransactionListItem[];
  categories: Category[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onCategoryChange: (tx: TransactionListItem, newCategoryId: string | null) => void;
  onToggleSelected: (id: string) => void;
  onRangeSelect: (anchorId: string, targetId: string) => void;
  onToggleAllVisible: (visible: TransactionListItem[]) => void;
}) {
  const allVisibleSelected = useMemo(
    () => items.length > 0 && items.every((t) => selectedIds.has(t.id)),
    [items, selectedIds],
  );
  const someVisibleSelected = useMemo(
    () => items.some((t) => selectedIds.has(t.id)),
    [items, selectedIds],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--color-muted)] bg-[var(--color-bg)]/50">
          <tr>
            <th className="text-center px-2 py-2 font-medium w-8">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                }}
                onChange={() => onToggleAllVisible(items)}
                aria-label="Seleccionar todas las filas visibles"
                className="cursor-pointer"
              />
            </th>
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
              <td colSpan={7} className="text-center py-12 text-[var(--color-muted)]">
                No hay movimientos que coincidan con los filtros.
              </td>
            </tr>
          ) : (
            items.map((t, idx) => {
              const isSelected = t.id === selectedId;
              const isChecked = selectedIds.has(t.id);
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
                    isChecked && 'bg-[var(--color-accent)]/5',
                    t.status === 'pending' && 'border-l-2 border-l-amber-500 border-l-dashed',
                  )}
                >
                  <td
                    className="px-2 py-2 text-center"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const native = e.nativeEvent as MouseEvent;
                        if (native.shiftKey) {
                          // Find the closest previously-checked item to use as anchor.
                          const anchor = [...items]
                            .slice(0, idx)
                            .reverse()
                            .find((it) => selectedIds.has(it.id));
                          if (anchor) {
                            onRangeSelect(anchor.id, t.id);
                            return;
                          }
                        }
                        onToggleSelected(t.id);
                      }}
                      aria-label={`Seleccionar ${t.normalizedMerchant ?? t.descriptionRaw}`}
                      className="cursor-pointer"
                    />
                  </td>
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
                  <td
                    className="px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <CategoryCell
                      tx={t}
                      categories={categories}
                      onChange={(id) => onCategoryChange(t, id)}
                    />
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
