'use client';

import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEur } from '@/lib/format';
import type { RecurringKind, RecurringRuleEnriched } from '@gp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const KIND_LABELS: Record<RecurringKind, string> = {
  subscription: 'Suscripción',
  bill: 'Factura',
  salary: 'Nómina',
  rent: 'Alquiler',
  transfer: 'Transferencia',
  other: 'Otro',
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  biannual: 'Semestral',
  yearly: 'Anual',
  custom: 'Personalizado',
};

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

export function RecurrentesClient() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<RecurringRuleEnriched | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['recurring-rules'],
    queryFn: api.getRecurringRules,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteRecurringRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-rules'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirming(null);
    },
  });

  const items = data?.items ?? [];
  const summary = data?.summary;

  // Buckets are decided by `kind` (salary → inflow, everything else →
  // outflow) since `expectedAmount` is stored unsigned in the seed/manual
  // flows. Within each bucket, sort by annualised cost descending so the
  // heaviest item leads.
  const sortedOutflows = items
    .filter((r) => r.kind !== 'salary')
    .sort((a, b) => Math.abs(Number(b.annualCost)) - Math.abs(Number(a.annualCost)));
  const sortedInflows = items
    .filter((r) => r.kind === 'salary')
    .sort((a, b) => Math.abs(Number(b.annualCost)) - Math.abs(Number(a.annualCost)));

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Pagos recurrentes"
        subtitle={`${summary?.activeCount ?? 0} reglas activas`}
      />

      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Salida mensual" value={formatEur(summary.monthlyOutflow)} tone="negative" />
          <Kpi label="Entrada mensual" value={formatEur(summary.monthlyInflow)} tone="positive" />
          <Kpi
            label="Salida anual"
            value={formatEur(summary.annualOutflow, { compact: true })}
            tone="negative"
          />
          <Kpi
            label="Entrada anual"
            value={formatEur(summary.annualInflow, { compact: true })}
            tone="positive"
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="p-12 text-center text-[var(--color-muted)]">Cargando…</div>
      ) : isError ? (
        <div className="p-12 text-center text-[var(--color-negative)]">
          Error: {error instanceof Error ? error.message : 'desconocido'}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {sortedOutflows.length > 0 ? (
            <RuleSection title="Salidas" rules={sortedOutflows} onDelete={setConfirming} />
          ) : null}
          {sortedInflows.length > 0 ? (
            <RuleSection title="Entradas" rules={sortedInflows} onDelete={setConfirming} />
          ) : null}
        </>
      )}

      {confirming ? (
        <ConfirmDeleteDialog
          rule={confirming}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(confirming.id)}
          onDismiss={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div
        className={cn(
          'text-xl font-semibold tabular-nums mt-1',
          tone === 'positive' ? 'text-[var(--color-positive)]' : 'text-[var(--color-fg)]',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-muted)]">
      <p className="text-sm">
        Aún no hay reglas recurrentes. Marca movimientos como recurrentes desde la pestaña{' '}
        <strong>Movimientos</strong> y aparecerán aquí.
      </p>
    </div>
  );
}

function RuleSection({
  title,
  rules,
  onDelete,
}: {
  title: string;
  rules: RecurringRuleEnriched[];
  onDelete: (rule: RecurringRuleEnriched) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-[var(--color-muted)]">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-muted)] bg-[var(--color-bg)]/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Nombre</th>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Frecuencia</th>
              <th className="text-right px-3 py-2 font-medium">Importe</th>
              <th className="text-right px-3 py-2 font-medium">Anual</th>
              <th className="text-center px-3 py-2 font-medium w-16">Cargos</th>
              <th className="text-left px-3 py-2 font-medium w-20">Último</th>
              <th className="text-left px-3 py-2 font-medium w-20">Próximo</th>
              <th className="text-center px-3 py-2 font-medium w-12" aria-label="acciones" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr
                key={r.id}
                className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg)]/30"
              >
                <td className="px-3 py-2">
                  <div className="font-medium flex items-center gap-1.5 flex-wrap">
                    <span>{r.name}</span>
                    {r.detectedAutomatically ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                        title="Detectada automáticamente"
                      >
                        auto
                      </span>
                    ) : null}
                    {r.amountKind === 'variable' ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-muted)]/15 text-[var(--color-muted)]"
                        title="Importe variable — los cargos pueden cambiar mes a mes"
                      >
                        variable
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{KIND_LABELS[r.kind]}</td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.amountKind === 'variable' ? '≈ ' : ''}
                  {formatEur(r.expectedAmount)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right tabular-nums font-medium',
                    r.kind === 'salary' ? 'text-[var(--color-positive)]' : 'text-[var(--color-fg)]',
                  )}
                >
                  {r.amountKind === 'variable' ? '≈ ' : ''}
                  {formatEur(r.annualCost, { compact: true })}
                </td>
                <td className="px-3 py-2 text-center text-[var(--color-muted)]">{r.linkedCount}</td>
                <td className="px-3 py-2 text-[var(--color-muted)] whitespace-nowrap">
                  {formatShortDate(r.lastChargedAt)}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)] whitespace-nowrap">
                  {formatShortDate(r.nextExpectedAt)}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    aria-label={`Eliminar regla ${r.name}`}
                    title="Eliminar"
                    className="text-[var(--color-muted)] hover:text-[var(--color-negative)]"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConfirmDeleteDialog({
  rule,
  isPending,
  onConfirm,
  onDismiss,
}: {
  rule: RecurringRuleEnriched;
  isPending: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 m-0 w-screen h-screen max-w-none max-h-none flex items-center justify-center bg-black/40 p-4 text-[var(--color-fg)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-delete-title" className="text-lg font-semibold">
          ¿Eliminar regla?
        </h3>
        <p className="text-sm text-[var(--color-muted)]">
          Se desvincularán los <strong>{rule.linkedCount}</strong>{' '}
          {rule.linkedCount === 1 ? 'movimiento' : 'movimientos'} asociados a{' '}
          <strong>{rule.name}</strong> y la regla quedará archivada. Los movimientos en sí no se
          borran.
        </p>
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
            onClick={onConfirm}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-negative)] text-white disabled:opacity-50"
          >
            {isPending ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
