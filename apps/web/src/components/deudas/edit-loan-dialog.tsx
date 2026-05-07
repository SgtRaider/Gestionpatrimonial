'use client';

import type { LoanDetail } from '@gp/shared';
import { useEffect, useState } from 'react';

type Props = {
  loan: LoanDetail;
  isPending: boolean;
  onConfirm: (patch: {
    alias: string | null;
    lender: string;
    rateFixed: string | null;
    rateIndex: string | null;
    rateSpread: string | null;
    reviewFrequencyMonths: number | null;
    prepaymentFeePct: string;
    fiscalDeductible: boolean;
    notes: string | null;
  }) => void;
  onDismiss: () => void;
};

export function EditLoanDialog({ loan, isPending, onConfirm, onDismiss }: Props) {
  const [alias, setAlias] = useState(loan.alias ?? '');
  const [lender, setLender] = useState(loan.lender);
  const [rateFixed, setRateFixed] = useState(
    loan.rateType === 'fixed' ? (loan.currentRatePct ?? '') : '',
  );
  const [rateIndex, setRateIndex] = useState(loan.rateIndex ?? '');
  const [rateSpread, setRateSpread] = useState(loan.rateSpread ?? '');
  const [reviewMonths, setReviewMonths] = useState(
    loan.reviewFrequencyMonths != null ? String(loan.reviewFrequencyMonths) : '',
  );
  const [feePct, setFeePct] = useState(loan.prepaymentFeePct ?? '0');
  const [fiscal, setFiscal] = useState(loan.fiscalDeductible);
  const [notes, setNotes] = useState(loan.notes ?? '');

  useEffect(() => {
    setAlias(loan.alias ?? '');
    setLender(loan.lender);
    setRateIndex(loan.rateIndex ?? '');
    setRateSpread(loan.rateSpread ?? '');
    setReviewMonths(loan.reviewFrequencyMonths != null ? String(loan.reviewFrequencyMonths) : '');
    setFeePct(loan.prepaymentFeePct ?? '0');
    setFiscal(loan.fiscalDeductible);
    setNotes(loan.notes ?? '');
  }, [loan]);

  const canSubmit = lender.trim().length > 0 && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="edit-loan-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="edit-loan-title" className="text-lg font-semibold">
              Editar préstamo
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              El capital, plazo y sistema de amortización no se editan — cambiarlos invalidaría los
              pagos ya emparejados. Para una novación, registra una nueva revisión de tipo.
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Alias">
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={100}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
          <Field label="Banco / Acreedor">
            <input
              type="text"
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              maxLength={100}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
        </div>

        {loan.rateType === 'fixed' ? (
          <Field label="Tipo fijo %">
            <input
              type="text"
              value={rateFixed}
              onChange={(e) => setRateFixed(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Índice">
              <input
                type="text"
                value={rateIndex}
                onChange={(e) => setRateIndex(e.target.value)}
                className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
              />
            </Field>
            <Field label="Diferencial %">
              <input
                type="text"
                value={rateSpread}
                onChange={(e) => setRateSpread(e.target.value)}
                className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
              />
            </Field>
            <Field label="Revisión (meses)">
              <input
                type="text"
                value={reviewMonths}
                onChange={(e) => setReviewMonths(e.target.value)}
                className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Comisión cancelación %">
            <input
              type="text"
              value={feePct}
              onChange={(e) => setFeePct(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={fiscal} onChange={(e) => setFiscal(e.target.checked)} />
            <span>Deducible fiscalmente</span>
          </label>
        </div>

        <Field label="Notas">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={3}
            className="mt-1 w-full px-3 py-1.5 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] resize-none"
          />
        </Field>

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
                alias: alias.trim() || null,
                lender: lender.trim(),
                rateFixed: loan.rateType === 'fixed' ? rateFixed : null,
                rateIndex: loan.rateType !== 'fixed' ? rateIndex : null,
                rateSpread: loan.rateType !== 'fixed' ? rateSpread : null,
                reviewFrequencyMonths:
                  loan.rateType !== 'fixed' && reviewMonths ? Number(reviewMonths) : null,
                prepaymentFeePct: feePct || '0',
                fiscalDeductible: fiscal,
                notes: notes.trim() || null,
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)] block">
        {label}
      </span>
      {children}
    </div>
  );
}
