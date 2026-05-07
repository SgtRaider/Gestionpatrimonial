'use client';

import type { Certainty, PlannedEventKind, RecurringFrequency } from '@gp/shared';
import { useState } from 'react';

const KIND_LABELS: Record<PlannedEventKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  asset_purchase: 'Compra activo',
  asset_sale: 'Venta activo',
  loan_origination: 'Apertura préstamo',
  loan_payoff: 'Cancelación préstamo',
  life_event: 'Hito vital',
};

const CERTAINTY_LABELS: Record<Certainty, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  certain: 'Cierta',
};

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  biannual: 'Semestral',
  yearly: 'Anual',
  custom: 'Personalizado',
};

type Props = {
  isPending: boolean;
  onConfirm: (input: {
    name: string;
    kind: PlannedEventKind;
    amount: string;
    scheduledAt: string;
    certainty: Certainty;
    recurrenceFrequency: RecurringFrequency | null;
    recurrenceUntil: string | null;
  }) => void;
  onDismiss: () => void;
};

export function AddEventDialog({ isPending, onConfirm, onDismiss }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlannedEventKind>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [certainty, setCertainty] = useState<Certainty>('medium');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [until, setUntil] = useState('');

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const canSubmit = name.trim().length > 0 && numberValid(amount) && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="add-event-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 id="add-event-title" className="text-lg font-semibold">
            Nuevo evento planificado
          </h3>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar"
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>

        <Field label="Nombre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vacaciones Italia, Bonus marzo, …"
            maxLength={200}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PlannedEventKind)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              {(Object.keys(KIND_LABELS) as PlannedEventKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Importe €" hint="negativo = gasto">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="-2500"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
          <Field label="Certeza">
            <select
              value={certainty}
              onChange={(e) => setCertainty(e.target.value as Certainty)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              {(Object.keys(CERTAINTY_LABELS) as Certainty[]).map((c) => (
                <option key={c} value={c}>
                  {CERTAINTY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
          <legend className="px-1 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
            Recurrencia
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <span>Se repite</span>
          </label>
          {isRecurring ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Frecuencia">
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
              </Field>
              <Field label="Hasta" hint="opcional">
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
              </Field>
            </div>
          ) : null}
        </fieldset>

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
                name: name.trim(),
                kind,
                amount,
                scheduledAt: date,
                certainty,
                recurrenceFrequency: isRecurring ? frequency : null,
                recurrenceUntil: isRecurring && until ? until : null,
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)] block">
        {label}
        {hint ? <span className="ml-1 text-[10px] normal-case">({hint})</span> : null}
      </span>
      {children}
    </div>
  );
}
