'use client';

import type {
  RecurringAmountKind,
  RecurringFrequency,
  RecurringKind,
  RecurringRuleEnriched,
  RecurringStatus,
} from '@gp/shared';
import { useEffect, useState } from 'react';

type Props = {
  rule: RecurringRuleEnriched;
  isPending: boolean;
  onConfirm: (patch: {
    name: string;
    kind: RecurringKind;
    frequency: RecurringFrequency;
    amountKind: RecurringAmountKind;
    expectedAmount: string;
    status: RecurringStatus;
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
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  biannual: 'Semestral',
  yearly: 'Anual',
  custom: 'Personalizado',
};

const STATUS_LABELS: Record<RecurringStatus, string> = {
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

export function EditRecurringDialog({ rule, isPending, onConfirm, onDismiss }: Props) {
  const [name, setName] = useState(rule.name);
  const [kind, setKind] = useState<RecurringKind>(rule.kind);
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule.frequency);
  const [amountKind, setAmountKind] = useState<RecurringAmountKind>(rule.amountKind);
  const [amount, setAmount] = useState(rule.expectedAmount);
  const [status, setStatus] = useState<RecurringStatus>(rule.status);

  // Re-seed when switching between rules without unmounting the dialog.
  useEffect(() => {
    setName(rule.name);
    setKind(rule.kind);
    setFrequency(rule.frequency);
    setAmountKind(rule.amountKind);
    setAmount(rule.expectedAmount);
    setStatus(rule.status);
  }, [rule]);

  const trimmedName = name.trim();
  const amountValid = /^-?\d+(\.\d{1,2})?$/.test(amount);
  const canSubmit = trimmedName.length > 0 && amountValid && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="edit-recurring-title"
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
            <h3 id="edit-recurring-title" className="text-lg font-semibold">
              Editar regla
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {rule.linkedCount}{' '}
              {rule.linkedCount === 1 ? 'movimiento vinculado' : 'movimientos vinculados'}
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
              className="w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
            <span className="text-[11px] text-[var(--color-muted)] mt-1 block">
              {amountKind === 'fixed'
                ? 'Importe exacto que se carga cada periodo.'
                : 'Importe orientativo. El detector enlazará cargos del mismo comercio aunque varíen.'}
            </span>
          </fieldset>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Estado
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RecurringStatus)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              {(Object.keys(STATUS_LABELS) as RecurringStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[var(--color-muted)] mt-1 block">
              Las pausadas/canceladas no cuentan en los KPIs del mes.
            </span>
          </label>
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
