'use client';

import type { GoalEnriched, GoalStatus } from '@gp/shared';
import { useEffect, useState } from 'react';

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Activo',
  achieved: 'Conseguido',
  abandoned: 'Abandonado',
};

type Props = {
  goal: GoalEnriched;
  isPending: boolean;
  onConfirm: (patch: {
    name: string;
    targetAmount: string;
    targetDate: string | null;
    currentAmount: string;
    monthlyContributionTarget: string | null;
    status: GoalStatus;
  }) => void;
  onDismiss: () => void;
};

export function EditGoalDialog({ goal, isPending, onConfirm, onDismiss }: Props) {
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(goal.targetAmount);
  const [date, setDate] = useState(goal.targetDate ?? '');
  const [current, setCurrent] = useState(goal.currentAmount);
  const [monthly, setMonthly] = useState(goal.monthlyContributionTarget ?? '');
  const [status, setStatus] = useState<GoalStatus>(goal.status);

  useEffect(() => {
    setName(goal.name);
    setTarget(goal.targetAmount);
    setDate(goal.targetDate ?? '');
    setCurrent(goal.currentAmount);
    setMonthly(goal.monthlyContributionTarget ?? '');
    setStatus(goal.status);
  }, [goal]);

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const canSubmit = name.trim().length > 0 && numberValid(target) && !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="edit-goal-title"
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
          <h3 id="edit-goal-title" className="text-lg font-semibold">
            Editar objetivo
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
          <Field label="Objetivo €">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
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
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
        </div>

        <Field label="Estado">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GoalStatus)}
            className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            {(Object.keys(STATUS_LABELS) as GoalStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
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
                name: name.trim(),
                targetAmount: target,
                targetDate: date || null,
                currentAmount: current,
                monthlyContributionTarget: monthly || null,
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
