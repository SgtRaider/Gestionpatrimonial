'use client';

import type {
  Certainty,
  PlannedEvent,
  PlannedEventKind,
  PlannedEventStatus,
  RecurringFrequency,
} from '@gp/shared';
import { useEffect, useState } from 'react';

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

const STATUS_LABELS: Record<PlannedEventStatus, string> = {
  planned: 'Planificado',
  confirmed: 'Confirmado',
  executed: 'Ejecutado',
  cancelled: 'Cancelado',
};

type Props = {
  event: PlannedEvent;
  isPending: boolean;
  onConfirm: (patch: {
    name: string;
    kind: PlannedEventKind;
    amount: string;
    scheduledAt: string;
    certainty: Certainty;
    recurrenceFrequency: RecurringFrequency | null;
    recurrenceUntil: string | null;
    status: PlannedEventStatus;
  }) => void;
  onDismiss: () => void;
};

export function EditEventDialog({ event, isPending, onConfirm, onDismiss }: Props) {
  const [name, setName] = useState(event.name);
  const [kind, setKind] = useState<PlannedEventKind>(event.kind);
  const [amount, setAmount] = useState(event.amount);
  const [date, setDate] = useState(event.scheduledAt);
  const [certainty, setCertainty] = useState<Certainty>(event.certainty);
  const [isRecurring, setIsRecurring] = useState(event.recurrenceFrequency != null);
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    event.recurrenceFrequency ?? 'monthly',
  );
  const [until, setUntil] = useState(event.recurrenceUntil ?? '');
  const [status, setStatus] = useState<PlannedEventStatus>(event.status);

  useEffect(() => {
    setName(event.name);
    setKind(event.kind);
    setAmount(event.amount);
    setDate(event.scheduledAt);
    setCertainty(event.certainty);
    setIsRecurring(event.recurrenceFrequency != null);
    setFrequency(event.recurrenceFrequency ?? 'monthly');
    setUntil(event.recurrenceUntil ?? '');
    setStatus(event.status);
  }, [event]);

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const canSubmit = name.trim().length > 0 && numberValid(amount) && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="edit-event-title"
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
          <h3 id="edit-event-title" className="text-lg font-semibold">
            Editar evento
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
          <Field label="Importe €">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
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
          <Field label="Estado">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PlannedEventStatus)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              {(Object.keys(STATUS_LABELS) as PlannedEventStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
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
                status,
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
