'use client';

import { useState } from 'react';

type Source = 'contract' | 'review' | 'novation';

const SOURCE_LABELS: Record<Source, string> = {
  contract: 'Contrato',
  review: 'Revisión periódica',
  novation: 'Novación',
};

type Props = {
  defaultEffectiveAt: string;
  defaultRate: string;
  rateSpread: string | null;
  isPending: boolean;
  onConfirm: (input: {
    effectiveAt: string;
    rate: string;
    source: Source;
    indexValueAtReview?: string;
  }) => void;
  onDismiss: () => void;
};

export function AddRateReviewDialog({
  defaultEffectiveAt,
  defaultRate,
  rateSpread,
  isPending,
  onConfirm,
  onDismiss,
}: Props) {
  const [effectiveAt, setEffectiveAt] = useState(defaultEffectiveAt);
  const [source, setSource] = useState<Source>('review');
  const [indexValue, setIndexValue] = useState('');
  const [rateOverride, setRateOverride] = useState('');

  // Spread-based mode: when the user enters Euribor, derive the final rate.
  // Override mode: the user types the final rate directly. The override input
  // wins if non-empty.
  const computedRate = (() => {
    if (rateOverride.trim()) return rateOverride.trim();
    if (!indexValue.trim() || !rateSpread) return defaultRate;
    const sum = Number(indexValue) + Number(rateSpread);
    return Number.isFinite(sum) ? sum.toFixed(4) : defaultRate;
  })();

  const rateValid = /^-?\d+(\.\d+)?$/.test(computedRate);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(effectiveAt);
  const canSubmit = dateValid && rateValid && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="add-rate-review-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="add-rate-review-title" className="text-lg font-semibold">
              Añadir revisión de tipo
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              El schedule se recalcula al guardar.
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

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Fecha efectiva
          </span>
          <input
            type="date"
            value={effectiveAt}
            onChange={(e) => setEffectiveAt(e.target.value)}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Origen</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        {rateSpread ? (
          <fieldset className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
              Cálculo
            </legend>
            <label className="block text-sm">
              <span className="text-xs text-[var(--color-muted)]">Euribor (%)</span>
              <input
                type="text"
                value={indexValue}
                onChange={(e) => setIndexValue(e.target.value)}
                placeholder="2.150"
                className="mt-0.5 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
              />
            </label>
            <div className="text-[11px] text-[var(--color-muted)]">
              + diferencial fijo {rateSpread}% = <strong>{computedRate}%</strong>
            </div>
          </fieldset>
        ) : null}

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Tipo final {rateSpread ? '(opcional, sobrescribe el cálculo)' : ''}
          </span>
          <input
            type="text"
            value={rateOverride}
            onChange={(e) => setRateOverride(e.target.value)}
            placeholder={defaultRate}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          <span className="text-[11px] text-[var(--color-muted)] mt-1 block">
            Se guardará: <strong className="tabular-nums">{computedRate}%</strong>
          </span>
        </label>

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
            onClick={() =>
              onConfirm({
                effectiveAt,
                rate: computedRate,
                source,
                ...(indexValue.trim() ? { indexValueAtReview: indexValue.trim() } : {}),
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Guardar revisión'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
