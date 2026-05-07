'use client';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { LoanDetail, PrepaymentSimulationResponse } from '@gp/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  loan: LoanDetail;
  onClose: () => void;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function remainingYears(loan: LoanDetail): number {
  const remaining = loan.schedule.length - loan.lastPaidPeriod;
  return Math.max(1, Math.round(remaining / 12));
}

export function InvestVsAmortizeDialog({ loan, onClose }: Props) {
  const [amount, setAmount] = useState('5000');
  const [date, setDate] = useState(todayYmd());
  const [feePct, setFeePct] = useState(() => loan.prepaymentFeePct ?? '0');
  const [expectedReturnPct, setExpectedReturnPct] = useState('6.5');
  const [horizonYears, setHorizonYears] = useState(() => String(remainingYears(loan)));
  const [taxRatePct, setTaxRatePct] = useState('21');
  const [amortResult, setAmortResult] = useState<PrepaymentSimulationResponse | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const simulation = useMutation({
    mutationFn: () =>
      api.simulatePrepayment(loan.id, {
        amount,
        occurredAt: date,
        // For the comparison, "reduce_term" is the standard — it's the mode
        // that maximises interest savings (vs. reduce_payment which preserves
        // term and frees up cash flow instead).
        mode: 'reduce_term',
      }),
    onSuccess: (resp) => setAmortResult(resp),
  });

  // Recompute amortization side whenever amount/date change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately scoped to user inputs
  useEffect(() => {
    const handle = setTimeout(() => {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setAmortResult(null);
        return;
      }
      simulation.mutate();
    }, 350);
    return () => clearTimeout(handle);
  }, [amount, date]);

  // Pure client-side numbers (recompute on every render — they're cheap).
  const amountNumber = Number(amount) || 0;
  const feePctNumber = Number(feePct) || 0;
  const returnPctNumber = Number(expectedReturnPct) || 0;
  const horizonYearsNumber = Math.max(0, Number(horizonYears) || 0);
  const taxRatePctNumber = Math.min(100, Math.max(0, Number(taxRatePct) || 0));

  const amortize = useMemo(() => {
    const interestSaved = amortResult ? Number(amortResult.interestSaved) : 0;
    const fee = (amountNumber * feePctNumber) / 100;
    return {
      interestSaved,
      fee,
      net: interestSaved - fee,
      monthsSaved: amortResult?.monthsSaved ?? 0,
    };
  }, [amortResult, amountNumber, feePctNumber]);

  const invest = useMemo(() => {
    const futureValue = amountNumber * (1 + returnPctNumber / 100) ** horizonYearsNumber;
    const grossGain = futureValue - amountNumber;
    const tax = grossGain > 0 ? (grossGain * taxRatePctNumber) / 100 : 0;
    return {
      futureValue,
      grossGain,
      tax,
      net: grossGain - tax,
    };
  }, [amountNumber, returnPctNumber, horizonYearsNumber, taxRatePctNumber]);

  const winner: 'amortize' | 'invest' | 'tie' =
    Math.abs(invest.net - amortize.net) < 1
      ? 'tie'
      : invest.net > amortize.net
        ? 'invest'
        : 'amortize';
  const diff = Math.abs(invest.net - amortize.net);

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="invest-vs-amortize-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 id="invest-vs-amortize-title" className="text-lg font-semibold mb-1">
          ¿Amortizar o invertir?
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Análisis comparativo a igualdad de horizonte y aportación.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <NumberField
            label="Importe disponible"
            suffix="€"
            value={amount}
            onChange={setAmount}
            step="100"
          />
          <DateField label="Fecha amortización" value={date} onChange={setDate} />
          <NumberField
            label="Comisión amortización"
            suffix="%"
            value={feePct}
            onChange={setFeePct}
            step="0.05"
            {...(loan.prepaymentFeePct ? { hint: `Contrato: ${loan.prepaymentFeePct}%` } : {})}
          />
          <NumberField
            label="Rentab. esperada cartera"
            suffix="% TAE"
            value={expectedReturnPct}
            onChange={setExpectedReturnPct}
            step="0.1"
            hint={`Tipo hipoteca actual: ${loan.currentRatePct}%`}
          />
          <NumberField
            label="Horizonte"
            suffix="años"
            value={horizonYears}
            onChange={setHorizonYears}
            step="1"
          />
          <NumberField
            label="Plusvalías al rescate"
            suffix="%"
            value={taxRatePct}
            onChange={setTaxRatePct}
            step="1"
            hint="ES: 19/21/23/27% por tramos"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            title="Opción A — Amortizar"
            highlight={winner === 'amortize'}
            note="Ahorro de intereses al pagar capital del préstamo, menos comisión."
          >
            {!amortResult && simulation.isPending ? (
              <div className="text-sm text-[var(--color-muted)] py-3">Calculando…</div>
            ) : !amortResult ? (
              <div className="text-sm text-[var(--color-muted)] py-3">
                Introduce un importe válido.
              </div>
            ) : (
              <>
                <Row
                  label="Ahorro intereses"
                  value={formatEur(amortize.interestSaved.toFixed(2))}
                />
                {amortize.fee > 0 ? (
                  <Row
                    label="Comisión"
                    value={`−${formatEur(amortize.fee.toFixed(2))}`}
                    tone="negative"
                  />
                ) : null}
                <Row label="Beneficio neto" value={formatEur(amortize.net.toFixed(2))} emphasized />
                <p className="text-[10px] text-[var(--color-muted)] mt-1">
                  {amortize.monthsSaved > 0
                    ? `Plazo ${amortize.monthsSaved} m antes`
                    : 'Sin reducción de plazo'}
                  {' · '}Riesgo: nulo (rentabilidad garantizada = tipo hipoteca)
                </p>
              </>
            )}
          </Card>

          <Card
            title="Opción B — Invertir"
            highlight={winner === 'invest'}
            note="Aportar el importe a la cartera y dejar que componga."
          >
            <Row label="Valor futuro" value={formatEur(invest.futureValue.toFixed(2))} />
            <Row label="Plusvalía bruta" value={formatEur(invest.grossGain.toFixed(2))} />
            {invest.tax > 0 ? (
              <Row
                label={`Impuestos (${taxRatePctNumber}%)`}
                value={`−${formatEur(invest.tax.toFixed(2))}`}
                tone="negative"
              />
            ) : null}
            <Row
              label="Beneficio neto esperado"
              value={formatEur(invest.net.toFixed(2))}
              emphasized
            />
            <p className="text-[10px] text-[var(--color-muted)] mt-1">
              Riesgo: medio · rentabilidad no garantizada (volatilidad)
            </p>
          </Card>
        </div>

        <div
          className={cn(
            'mt-4 p-3 rounded-lg border',
            winner === 'invest'
              ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5'
              : winner === 'amortize'
                ? 'border-[var(--color-positive)]/40 bg-[var(--color-positive)]/5'
                : 'border-[var(--color-border)] bg-[var(--color-bg)]',
          )}
        >
          <p className="text-sm">
            {winner === 'tie' ? (
              <>📊 Las dos opciones rinden aproximadamente lo mismo en este escenario.</>
            ) : winner === 'invest' ? (
              <>
                💡 Invertir gana <strong>{formatEur(diff.toFixed(2))}</strong> extra (esperado, no
                garantizado)
              </>
            ) : (
              <>
                🏦 Amortizar gana <strong>{formatEur(diff.toFixed(2))}</strong> extra de forma
                garantizada
              </>
            )}
          </p>
          <p className="text-[10px] text-[var(--color-muted)] mt-1">
            ⓘ Cálculos con interés compuesto sobre la aportación inicial. La rentabilidad de la
            cartera es esperada y no garantizada; amortizar es equivalente a obtener tu tipo
            hipotecario sin riesgo.
          </p>
        </div>

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

function NumberField({
  label,
  suffix,
  value,
  onChange,
  step,
  hint,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <div className="mt-1 flex items-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]/40">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step}
          min="0"
          className="flex-1 h-9 px-2 text-sm bg-transparent focus:outline-none tabular-nums"
        />
        <span className="px-2 text-[var(--color-muted)] text-sm">{suffix}</span>
      </div>
      {hint ? (
        <span className="text-[10px] text-[var(--color-muted)] mt-0.5 block">{hint}</span>
      ) : null}
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-9 px-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
      />
    </label>
  );
}

function Card({
  title,
  highlight,
  note,
  children,
}: {
  title: string;
  highlight: boolean;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-3 space-y-1.5 border',
        highlight
          ? 'border-2 border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border)]',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{title}</div>
        {highlight ? (
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-accent)] font-medium">
            ★ Mejor opción
          </span>
        ) : null}
      </div>
      <div className="space-y-1">{children}</div>
      {note ? <p className="text-[10px] text-[var(--color-muted)] mt-1">{note}</p> : null}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  emphasized,
}: {
  label: string;
  value: string;
  tone?: 'negative';
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between items-baseline gap-2',
        emphasized && 'pt-1 border-t border-[var(--color-border)] mt-1',
      )}
    >
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          emphasized ? 'font-semibold text-sm' : 'font-medium text-sm',
          tone === 'negative' && 'text-[var(--color-negative)]',
          emphasized && tone !== 'negative' && 'text-[var(--color-positive)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}
