'use client';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { LoanDetail, PrepaymentMode, PrepaymentSimulationResponse } from '@gp/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type Props = {
  loan: LoanDetail;
  onClose: () => void;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PrepaymentDialog({ loan, onClose }: Props) {
  const [amount, setAmount] = useState('5000');
  const [date, setDate] = useState(todayYmd());
  const [mode, setMode] = useState<PrepaymentMode>('reduce_term');
  const [result, setResult] = useState<PrepaymentSimulationResponse | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const simulation = useMutation({
    mutationFn: () => api.simulatePrepayment(loan.id, { amount, occurredAt: date, mode }),
    onSuccess: (resp) => setResult(resp),
  });

  // Recompute whenever inputs change (debounced). The mutation reference
  // intentionally isn't a dependency — re-running on its identity change would
  // double-fire on every simulation. Effect inputs are the user-controlled
  // values only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    const handle = setTimeout(() => {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setResult(null);
        return;
      }
      simulation.mutate();
    }, 350);
    return () => clearTimeout(handle);
  }, [amount, date, mode]);

  const fee = result?.fee ?? '0.00';
  const feeIsZero = !fee || Number(fee) === 0;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="prepayment-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 id="prepayment-title" className="text-lg font-semibold mb-1">
          Simular amortización anticipada
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Estima el ahorro reduciendo plazo o cuota.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Importe
            </span>
            <div className="mt-1 flex items-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]/40">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="100"
                min="0"
                className="flex-1 h-9 px-2 text-sm bg-transparent focus:outline-none tabular-nums"
              />
              <span className="px-2 text-[var(--color-muted)] text-sm">€</span>
            </div>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </label>
        </div>

        <fieldset className="mb-4">
          <legend className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">
            Modo
          </legend>
          <div className="flex gap-2">
            {(
              [
                {
                  value: 'reduce_term',
                  label: 'Reducir plazo',
                  hint: 'Mismo importe de cuota, menos meses',
                },
                {
                  value: 'reduce_payment',
                  label: 'Reducir cuota',
                  hint: 'Mismo plazo, cuota menor',
                },
              ] as { value: PrepaymentMode; label: string; hint: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={cn(
                  'flex-1 text-left px-3 py-2 rounded border text-sm',
                  mode === opt.value
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg)]',
                )}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-[var(--color-muted)]">{opt.hint}</div>
              </button>
            ))}
          </div>
        </fieldset>

        {result ? (
          <ScenarioComparison result={result} mode={mode} />
        ) : simulation.isPending ? (
          <div className="text-sm text-[var(--color-muted)] py-6 text-center">Calculando…</div>
        ) : simulation.isError ? (
          <div className="text-sm text-[var(--color-negative)] py-3">
            {simulation.error instanceof Error ? simulation.error.message : 'Error desconocido'}
          </div>
        ) : null}

        {result && !feeIsZero ? (
          <p className="text-xs text-[var(--color-warning)] mt-3">
            ⚠ Comisión de amortización aproximada: <strong>{formatEur(fee)}</strong> (
            {loan.prepaymentFeePct}% sobre {formatEur(amount || '0')})
          </p>
        ) : null}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ScenarioComparison({
  result,
  mode,
}: {
  result: PrepaymentSimulationResponse;
  mode: PrepaymentMode;
}) {
  const monthsSaved = result.monthsSaved;
  const yearsSaved = monthsSaved >= 12 ? Math.floor(monthsSaved / 12) : 0;
  const monthsRemainder = monthsSaved % 12;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          Sin amortizar
        </div>
        <div className="space-y-1.5 text-sm">
          <Row label="Cuota" value={formatEur(result.baseline.payment)} />
          <Row label="Cuotas restantes" value={`${result.baseline.termMonths}`} />
          <Row label="Fin contrato" value={formatLongDate(result.baseline.finalDate)} />
          <Row
            label="Intereses pendientes"
            value={formatEur(result.baseline.totalInterestRemaining)}
          />
        </div>
      </div>

      <div className="border-2 border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 rounded-lg p-3 space-y-2">
        <div className="text-xs uppercase tracking-wide text-[var(--color-accent)]">
          Con amortización
        </div>
        <div className="space-y-1.5 text-sm">
          <Row
            label="Cuota"
            value={formatEur(result.withPrepayment.payment)}
            delta={mode === 'reduce_payment' ? formatEur(result.paymentDelta) : '='}
          />
          <Row
            label="Cuotas restantes"
            value={`${result.withPrepayment.termMonths}`}
            delta={mode === 'reduce_term' ? `−${monthsSaved} m` : '='}
          />
          <Row label="Fin contrato" value={formatLongDate(result.withPrepayment.finalDate)} />
          <Row
            label="Intereses pendientes"
            value={formatEur(result.withPrepayment.totalInterestRemaining)}
          />
        </div>
        <div className="pt-2 border-t border-[var(--color-accent)]/20 text-sm">
          <div className="text-xs text-[var(--color-muted)]">Ahorro intereses</div>
          <div className="font-semibold tabular-nums text-[var(--color-positive)]">
            {formatEur(result.interestSaved)}
            {monthsSaved > 0 ? (
              <span className="text-xs font-normal text-[var(--color-muted)] ml-2">
                ·{' '}
                {yearsSaved > 0
                  ? `${yearsSaved} a${monthsRemainder > 0 ? ` ${monthsRemainder} m` : ''}`
                  : `${monthsSaved} m`}{' '}
                antes
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <span className="tabular-nums font-medium">
        {value}
        {delta ? <span className="ml-2 text-xs text-[var(--color-muted)]">({delta})</span> : null}
      </span>
    </div>
  );
}

function formatLongDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    month: 'short',
    year: 'numeric',
  });
}
