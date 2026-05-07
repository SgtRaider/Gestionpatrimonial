'use client';

import { formatEur } from '@/lib/format';
import type { LoanPaymentMatch, LoanScheduleRow } from '@gp/shared';
import { useState } from 'react';

type Props = {
  row: LoanScheduleRow;
  candidates: LoanPaymentMatch[];
  isPending: boolean;
  onConfirm: (transactionId: string) => void;
  onDismiss: () => void;
};

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

export function ManualMatchDialog({ row, candidates, isPending, onConfirm, onDismiss }: Props) {
  const [selected, setSelected] = useState<string | null>(candidates[0]?.transactionId ?? null);

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="manual-match-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="manual-match-title" className="text-lg font-semibold">
              Vincular cargo a la cuota #{row.period}
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Cuota esperada: {formatEur(row.payment)} · vencimiento {row.dueAt}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar"
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>

        {candidates.length === 0 ? (
          <div className="border border-dashed border-[var(--color-border)] rounded p-6 text-center text-sm text-[var(--color-muted)]">
            No hay cargos huérfanos en el rango del préstamo. Asegúrate de haber importado el
            extracto del mes correspondiente.
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto space-y-1 text-sm">
            {candidates.map((c) => {
              const isSelected = selected === c.transactionId;
              return (
                <li key={c.transactionId}>
                  <label
                    className={`flex items-start gap-2 p-2 rounded cursor-pointer border ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-transparent hover:bg-[var(--color-bg)]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      value={c.transactionId}
                      checked={isSelected}
                      onChange={() => setSelected(c.transactionId)}
                      className="mt-0.5"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{c.descriptionRaw}</span>
                      <span className="block text-xs text-[var(--color-muted)]">
                        {formatLongDate(c.bookedAt)}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {formatEur(c.actualPayment)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || isPending}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Vincular'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
