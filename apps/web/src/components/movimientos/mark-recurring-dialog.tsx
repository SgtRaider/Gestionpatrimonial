'use client';

import { formatEur } from '@/lib/format';
import type {
  RecurringAmountKind,
  RecurringFrequency,
  RecurringKind,
  TransactionListItem,
} from '@gp/shared';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  transactions: TransactionListItem[];
  isPending: boolean;
  onConfirm: (input: {
    name: string;
    kind: RecurringKind;
    frequency: RecurringFrequency;
    amountKind: RecurringAmountKind;
    expectedAmount: string;
  }) => void;
  onDismiss: () => void;
};

const KIND_LABELS: Record<RecurringKind, string> = {
  subscription: 'Suscripción',
  bill: 'Factura',
  salary: 'Nómina',
  rent: 'Alquiler',
  transfer: 'Transferencia',
  other: 'Otro',
};

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  biannual: 'Semestral',
  yearly: 'Anual',
  custom: 'Personalizado',
};

function inferDefaults(transactions: TransactionListItem[]): {
  name: string;
  kind: RecurringKind;
  frequency: RecurringFrequency;
  amountKind: RecurringAmountKind;
  meanAmount: string;
} {
  const first = transactions[0];
  const name = first?.normalizedMerchant ?? first?.counterparty ?? first?.descriptionRaw ?? '';
  const amounts = transactions.map((t) => Number(t.amount));
  const sum = amounts.reduce((acc, n) => acc + n, 0);
  const mean = transactions.length === 0 ? 0 : sum / transactions.length;
  const meanAmount = mean.toFixed(2);

  let kind: RecurringKind = 'subscription';
  if (mean > 0) kind = 'salary';
  else if (Math.abs(mean) > 200) kind = 'bill';

  // Default to "variable" when amounts swing more than 5 % from the mean —
  // typical for utilities (Iberdrola, Aguas, gas) and salaries with monthly
  // bonuses. The user can override.
  let amountKind: RecurringAmountKind = 'fixed';
  if (transactions.length >= 2 && Math.abs(mean) > 0) {
    const min = Math.min(...amounts.map(Math.abs));
    const max = Math.max(...amounts.map(Math.abs));
    const meanAbs = Math.abs(mean);
    if (max - min > 0.5 && (max - min) / meanAbs > 0.05) amountKind = 'variable';
  }

  let frequency: RecurringFrequency = 'monthly';
  if (transactions.length >= 2) {
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.bookedAt).getTime() - new Date(b.bookedAt).getTime(),
    );
    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (!a || !b) continue;
      deltas.push(
        (new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
    }
    if (deltas.length > 0) {
      const avg = deltas.reduce((acc, d) => acc + d, 0) / deltas.length;
      if (avg < 10) frequency = 'weekly';
      else if (avg < 45) frequency = 'monthly';
      else if (avg < 130) frequency = 'quarterly';
      else if (avg < 230) frequency = 'biannual';
      else frequency = 'yearly';
    }
  }

  return { name: name.slice(0, 200), kind, frequency, amountKind, meanAmount };
}

export function MarkRecurringDialog({ transactions, isPending, onConfirm, onDismiss }: Props) {
  const defaults = useMemo(() => inferDefaults(transactions), [transactions]);
  const [name, setName] = useState(defaults.name);
  const [kind, setKind] = useState<RecurringKind>(defaults.kind);
  const [frequency, setFrequency] = useState<RecurringFrequency>(defaults.frequency);
  const [amountKind, setAmountKind] = useState<RecurringAmountKind>(defaults.amountKind);
  const [amount, setAmount] = useState(defaults.meanAmount);

  // Re-seed when the selection changes (different merchants → fresh defaults).
  useEffect(() => {
    setName(defaults.name);
    setKind(defaults.kind);
    setFrequency(defaults.frequency);
    setAmountKind(defaults.amountKind);
    setAmount(defaults.meanAmount);
  }, [defaults]);

  const trimmedName = name.trim();
  const amountValid = /^-?\d+(\.\d{1,2})?$/.test(amount);
  const canSubmit = trimmedName.length > 0 && amountValid && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="mark-recurring-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="mark-recurring-title" className="text-lg font-semibold">
              Marcar como recurrente
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {transactions.length === 1
                ? '1 movimiento se vinculará a esta regla.'
                : `${transactions.length} movimientos se vincularán a esta regla.`}
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

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Nombre
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Netflix, alquiler piso, …"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                Tipo
              </span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as RecurringKind)}
                className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
              >
                {(Object.keys(KIND_LABELS) as RecurringKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                Frecuencia
              </span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
              >
                {(Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="border border-[var(--color-border)] rounded-lg p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
              Importe
            </legend>
            <div className="flex items-center gap-4 text-sm mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="amount-kind"
                  value="fixed"
                  checked={amountKind === 'fixed'}
                  onChange={() => setAmountKind('fixed')}
                />
                Fijo
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="amount-kind"
                  value="variable"
                  checked={amountKind === 'variable'}
                  onChange={() => setAmountKind('variable')}
                />
                Variable
              </label>
            </div>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="-13.99"
              className="w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
            <span className="text-[11px] text-[var(--color-muted)] mt-1 block">
              {amountKind === 'fixed'
                ? `Importe fijo. Por defecto, la media (${formatEur(defaults.meanAmount)}).`
                : 'Importe orientativo (luz, gas, nómina, …). Se usa para KPIs y proyecciones; los cargos reales pueden variar.'}
            </span>
          </fieldset>
        </div>

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
                name: trimmedName,
                kind,
                frequency,
                amountKind,
                expectedAmount: amount,
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : '🔁 Marcar recurrente'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
