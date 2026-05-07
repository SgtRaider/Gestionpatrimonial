'use client';

import type { AmortizationSystem, LoanKind, RateType } from '@gp/shared';
import { useState } from 'react';

const KIND_LABELS: Record<LoanKind, string> = {
  mortgage: 'Hipoteca',
  personal: 'Personal',
  car: 'Coche',
  student: 'Estudios',
  other: 'Otro',
};

const SYSTEM_LABELS: Record<AmortizationSystem, string> = {
  french: 'Francés (cuota constante)',
  german: 'Alemán (capital constante)',
  american: 'Americano (sólo intereses + balloon)',
  bullet: 'Bullet (todo al final)',
};

const RATE_TYPE_LABELS: Record<RateType, string> = {
  fixed: 'Fijo',
  variable: 'Variable',
  mixed: 'Mixto',
};

type Props = {
  isPending: boolean;
  onConfirm: (input: {
    kind: LoanKind;
    alias: string | null;
    lender: string;
    principalInitial: string;
    startedAt: string;
    termMonths: number;
    amortizationSystem: AmortizationSystem;
    rateType: RateType;
    rateFixed: string | null;
    rateIndex: string | null;
    rateSpread: string | null;
    reviewFrequencyMonths: number | null;
    prepaymentFeePct: string;
    initialRate: string;
  }) => void;
  onDismiss: () => void;
};

export function AddLoanDialog({ isPending, onConfirm, onDismiss }: Props) {
  const [kind, setKind] = useState<LoanKind>('mortgage');
  const [alias, setAlias] = useState('');
  const [lender, setLender] = useState('');
  const [principal, setPrincipal] = useState('');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10));
  const [termMonths, setTermMonths] = useState('300');
  const [system, setSystem] = useState<AmortizationSystem>('french');
  const [rateType, setRateType] = useState<RateType>('variable');
  const [rateFixed, setRateFixed] = useState('');
  const [rateIndex, setRateIndex] = useState('Euríbor 12M');
  const [rateSpread, setRateSpread] = useState('0.99');
  const [reviewMonths, setReviewMonths] = useState('12');
  const [feePct, setFeePct] = useState('0.5');
  const [initialRate, setInitialRate] = useState('');

  const numberValid = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  const intValid = (s: string) => /^\d+$/.test(s) && Number(s) > 0;
  const canSubmit =
    lender.trim().length > 0 &&
    numberValid(principal) &&
    Number(principal) > 0 &&
    intValid(termMonths) &&
    numberValid(initialRate) &&
    !isPending;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="add-loan-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 id="add-loan-title" className="text-lg font-semibold">
            Añadir préstamo
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as LoanKind)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              {(Object.keys(KIND_LABELS) as LoanKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Banco / Acreedor">
            <input
              type="text"
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              placeholder="BBVA, Santander…"
              maxLength={100}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
        </div>

        <Field label="Alias" hint="opcional">
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Vivienda Cáceres, Coche eléctrico…"
            maxLength={100}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Capital inicial €">
            <input
              type="text"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="200000"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
          <Field label="Fecha firma">
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            />
          </Field>
          <Field label="Plazo (meses)">
            <input
              type="text"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              placeholder="300"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
        </div>

        <Field label="Sistema de amortización">
          <select
            value={system}
            onChange={(e) => setSystem(e.target.value as AmortizationSystem)}
            className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
          >
            {(Object.keys(SYSTEM_LABELS) as AmortizationSystem[]).map((s) => (
              <option key={s} value={s}>
                {SYSTEM_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>

        <fieldset className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
          <legend className="px-1 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
            Tipo de interés
          </legend>
          <Field label="Modalidad">
            <select
              value={rateType}
              onChange={(e) => setRateType(e.target.value as RateType)}
              className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              {(Object.keys(RATE_TYPE_LABELS) as RateType[]).map((r) => (
                <option key={r} value={r}>
                  {RATE_TYPE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>

          {rateType === 'fixed' ? (
            <Field label="Tipo fijo %">
              <input
                type="text"
                value={rateFixed}
                onChange={(e) => setRateFixed(e.target.value)}
                placeholder="2.5"
                className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
              />
            </Field>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Índice">
                <input
                  type="text"
                  value={rateIndex}
                  onChange={(e) => setRateIndex(e.target.value)}
                  placeholder="Euríbor 12M"
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

          <Field label="Tipo inicial %" hint="el primero registrado en histórico">
            <input
              type="text"
              value={initialRate}
              onChange={(e) => setInitialRate(e.target.value)}
              placeholder="3.52"
              className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
            />
          </Field>
        </fieldset>

        <Field label="Comisión de cancelación %" hint="opcional">
          <input
            type="text"
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
            className="mt-1 w-full h-9 px-3 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] tabular-nums"
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
                kind,
                alias: alias.trim() || null,
                lender: lender.trim(),
                principalInitial: principal,
                startedAt,
                termMonths: Number(termMonths),
                amortizationSystem: system,
                rateType,
                rateFixed: rateType === 'fixed' ? rateFixed : null,
                rateIndex: rateType !== 'fixed' ? rateIndex : null,
                rateSpread: rateType !== 'fixed' ? rateSpread : null,
                reviewFrequencyMonths:
                  rateType !== 'fixed' && reviewMonths ? Number(reviewMonths) : null,
                prepaymentFeePct: feePct || '0',
                initialRate,
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Crear préstamo'}
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
