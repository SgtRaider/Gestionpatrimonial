'use client';

import { useState } from 'react';

type Props = {
  isPending: boolean;
  onConfirm: (input: {
    name: string;
    targetAmount: string;
    targetDate: string | null;
    currentAmount: string;
    monthlyContributionTarget: string | null;
  }) => void;
  onDismiss: () => void;
};

export function AddGoalDialog({ isPending, onConfirm, onDismiss }: Props) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [current, setCurrent] = useState('0');
  const [monthly, setMonthly] = useState('');

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const canSubmit = name.trim().length > 0 && numberValid(target) && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="add-goal-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 id="add-goal-title" className="text-lg font-semibold">
            Nuevo objetivo
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
            placeholder="Fondo emergencia, Entrada piso, …"
            maxLength={200}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo €">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="15000"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
          <Field label="Fecha objetivo" hint="opcional">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Saldo actual €">
            <input
              type="text"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
          <Field label="Aportación €/mes" hint="opcional">
            <input
              type="text"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              placeholder="500"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
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
                name: name.trim(),
                targetAmount: target,
                targetDate: date || null,
                currentAmount: current || '0',
                monthlyContributionTarget: monthly || null,
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
